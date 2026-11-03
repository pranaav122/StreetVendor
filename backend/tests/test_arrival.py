from datetime import timedelta

import pytest
from sqlalchemy import text

from app.auth.security import utcnow
from test_auth import api
from test_vendors import categories, fix, operator, vendor
from test_locations import ready_vendor
from test_visits import action, pending

pytestmark = pytest.mark.integration


def send_fix(api, vendor, clock, monkeypatch, **changes):
    import app.location.service
    import app.visits.service

    monkeypatch.setattr(app.location.service, "utcnow", lambda: clock)
    monkeypatch.setattr(app.visits.service, "utcnow", lambda: clock)
    return api.put(
        "/api/v1/vendors/me/location",
        headers=vendor,
        json=fix(captured_at=clock.isoformat(), **changes),
    )


def test_two_separated_accurate_fixes_arrive_then_complete_without_recording_sale(
    api, vendor, pending, monkeypatch, database_sandbox
):
    visit, customer = pending
    assert action(api, visit, vendor, "accept").status_code == 200
    clock = utcnow()
    assert send_fix(api, vendor, clock, monkeypatch).status_code == 200
    current = api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()
    assert current["status"] == "APPROACHING"
    assert (
        send_fix(api, vendor, clock + timedelta(seconds=6), monkeypatch).status_code
        == 200
    )
    arrived = api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()
    assert arrived["status"] == "ARRIVED" and arrived["version"] == 4
    completed = action(api, arrived, vendor, "complete")
    assert completed.status_code == 200 and completed.json()["status"] == "COMPLETED"
    assert "sale" not in completed.text.lower()
    assert (
        api.get(
            f"/api/v1/requests/{visit['id']}/vendor-location", headers=customer
        ).status_code
        == 409
    )
    assert action(api, completed.json(), vendor, "complete").status_code == 409
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 5


@pytest.mark.parametrize("bad", [{"accuracy_m": 31}, {"longitude": 80.2717}])
def test_poor_or_outside_fix_resets_arrival_candidate(
    api, vendor, pending, monkeypatch, bad
):
    visit, customer = pending
    assert action(api, visit, vendor, "accept").status_code == 200
    clock = utcnow()
    assert send_fix(api, vendor, clock, monkeypatch).status_code == 200
    assert (
        send_fix(
            api, vendor, clock + timedelta(seconds=6), monkeypatch, **bad
        ).status_code
        == 200
    )
    assert (
        send_fix(api, vendor, clock + timedelta(seconds=12), monkeypatch).status_code
        == 200
    )
    assert (
        api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()["status"]
        == "APPROACHING"
    )


def test_batched_future_timestamps_do_not_satisfy_server_elapsed_time(
    api, vendor, pending, monkeypatch
):
    visit, customer = pending
    assert action(api, visit, vendor, "accept").status_code == 200
    clock = utcnow()
    assert send_fix(api, vendor, clock, monkeypatch).status_code == 200
    response = api.put(
        "/api/v1/vendors/me/location",
        headers=vendor,
        json=fix(captured_at=(clock + timedelta(seconds=6)).isoformat()),
    )
    assert response.status_code == 200
    assert (
        api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()["status"]
        == "APPROACHING"
    )


def test_resuming_sharing_uses_new_first_fix_and_discards_old_candidate(
    api, vendor, pending, monkeypatch
):
    import app.vendors.service

    visit, customer = pending
    assert action(api, visit, vendor, "accept").status_code == 200
    clock = utcnow()
    assert send_fix(api, vendor, clock, monkeypatch).status_code == 200
    assert (
        api.patch(
            "/api/v1/vendors/me/availability",
            headers=vendor,
            json={"is_available": False, "location_sharing_enabled": False},
        ).status_code
        == 200
    )
    resumed = clock + timedelta(seconds=6)
    monkeypatch.setattr(app.vendors.service, "utcnow", lambda: resumed)
    assert (
        api.patch(
            "/api/v1/vendors/me/availability",
            headers=vendor,
            json={
                "is_available": True,
                "location_sharing_enabled": True,
                "location": fix(captured_at=resumed.isoformat()),
            },
        ).status_code
        == 200
    )
    assert (
        api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()["status"]
        == "APPROACHING"
    )
    assert (
        send_fix(api, vendor, clock + timedelta(seconds=12), monkeypatch).status_code
        == 200
    )
    assert (
        api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()["status"]
        == "ARRIVED"
    )
