import importlib.util
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import text
from fastapi.testclient import TestClient
from app.main import create_app

from app.auth.security import utcnow
from test_auth import api
from test_vendors import categories, operator, vendor
from test_locations import ready_vendor
from test_visits import action, create_request, pending

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("age,remaining", [(89, 1), (91, 0)])
def test_retention_physically_erases_abandoned_fixes_only_after_freshness_window(
    api, ready_vendor, database_sandbox, age, remaining
):
    from app.jobs import retain_data

    now = utcnow()
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text("UPDATE vendor_locations SET captured_at=:captured"),
            {"captured": now - timedelta(seconds=age)},
        )
    with api.app.state.session_factory() as session:
        retain_data(session, now, limit=0)
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 1
    with api.app.state.session_factory() as session:
        retain_data(session, now, limit=1)
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == remaining
        # Erasure does not revoke an existing sharing choice or delete the profile.
        assert connection.scalar(text("SELECT is_available FROM vendor_profiles"))


def test_retention_skips_a_location_writer_and_preserves_its_fresh_replacement(
    api, ready_vendor, database_sandbox
):
    from app.jobs import retain_data
    from app.models.vendors import VendorProfile
    from app.location.schemas import ValidatedFix
    from app.vendors.service import write_location
    from sqlalchemy import select

    now = utcnow()
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text("UPDATE vendor_locations SET captured_at=:captured"),
            {"captured": now - timedelta(seconds=91)},
        )

    def cleanup():
        with api.app.state.session_factory() as session:
            retain_data(session, now)

    with api.app.state.session_factory() as writer:
        row = writer.scalar(select(VendorProfile).with_for_update())
        with ThreadPoolExecutor(max_workers=1) as pool:
            # The cleaner must skip the writer's vendor lock, not wait for a
            # location lock while holding locks that the writer needs later.
            pool.submit(cleanup).result(timeout=5)
        assert writer.scalar(text("SELECT count(*) FROM vendor_locations")) == 1
        write_location(writer, row.id, ValidatedFix(
            latitude=13.0827, longitude=80.2717, accuracy_m=10,
            captured_at=now, received_at=now,
        ))
        writer.commit()
    cleanup()
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT ST_X(position::geometry) FROM vendor_locations")) == 80.2717


def test_retention_redacts_terminal_points_and_preserves_active_work(
    api, pending, vendor, database_sandbox
):
    visit, customer = pending
    assert action(api, visit, customer, "cancel").status_code == 200
    assert importlib.util.find_spec("app.jobs") is not None
    from app.jobs import retain_data

    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE visit_requests SET created_at=now()-interval '3 days',expires_at=now()-interval '2 days',closed_at=now()-interval '25 hours'"
            )
        )
    active = create_request(api, customer, visit["vendor_id"])
    assert active.status_code == 201
    with api.app.state.session_factory() as session:
        retain_data(session, utcnow())
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(
            text(
                "SELECT meeting_point IS NULL AND meeting_label IS NULL FROM visit_requests WHERE id=:id"
            ),
            {"id": visit["id"]},
        )
        assert connection.scalar(
            text(
                "SELECT meeting_point IS NOT NULL AND closed_at IS NULL FROM visit_requests WHERE id=:id"
            ),
            {"id": active.json()["id"]},
        )
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 3


def test_ninety_day_purge_removes_parent_and_its_events(api, pending, database_sandbox):
    visit, customer = pending
    assert action(api, visit, customer, "cancel").status_code == 200
    from app.jobs import retain_data

    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE visit_requests SET created_at=now()-interval '100 days',expires_at=now()-interval '99 days',closed_at=now()-interval '91 days'"
            )
        )
    with api.app.state.session_factory() as session:
        retain_data(session, utcnow())
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM visit_requests")) == 0
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 0


@pytest.mark.parametrize("role", ["customer", "vendor"])
def test_account_deletion_cancels_active_visits_and_erases_meeting_point(
    api, vendor, pending, database_sandbox, role
):
    visit, customer = pending
    headers = customer if role == "customer" else vendor
    assert (
        api.request(
            "DELETE",
            "/api/v1/users/me",
            headers=headers,
            json={"confirmation": "DELETE"},
        ).status_code
        == 202
    )
    with database_sandbox.engine.connect() as connection:
        result = connection.execute(
            text("SELECT status,meeting_point IS NULL AS erased FROM visit_requests")
        ).one()
        assert result.status == "CANCELLED" and result.erased
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 2


def test_enabled_periodic_worker_expires_without_a_request_read(
    api, pending, database_sandbox
):
    worker_app = create_app(
        api.app.state.settings.model_copy(update={"jobs_enabled": True})
    )
    with TestClient(worker_app):
        with database_sandbox.engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE visit_requests SET created_at=now()-interval '10 minutes',expires_at=now()-interval '1 second'"
                )
            )
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            with database_sandbox.engine.connect() as connection:
                status = connection.scalar(text("SELECT status FROM visit_requests"))
            if status == "EXPIRED":
                break
            time.sleep(0.05)
        assert status == "EXPIRED"
