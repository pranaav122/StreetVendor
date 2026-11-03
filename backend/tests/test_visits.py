from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text

from test_auth import api, bearer, login, register
from test_vendors import categories, customer_headers, operator, vendor
from test_locations import ready_vendor

pytestmark = pytest.mark.integration


def create_request(api, headers, vendor_id, *, key=None, **changes):
    body = {
        "vendor_id": vendor_id,
        "meeting_point": {"latitude": 13.0827, "longitude": 80.2707},
        "meeting_label": "Public market entrance",
    } | changes
    return api.post(
        "/api/v1/requests",
        headers=headers | {"Idempotency-Key": key or str(uuid4())},
        json=body,
    )


def action(api, visit, headers, name, **changes):
    payload = {"expected_version": visit["version"]} | changes
    if name == "cancel":
        payload.setdefault("reason", "Plans changed")
    return api.post(
        f"/api/v1/requests/{visit['id']}/{name}", headers=headers, json=payload
    )


@pytest.fixture
def pending(api, ready_vendor):
    customer = customer_headers(api)
    response = create_request(api, customer, ready_vendor[0]["id"])
    assert response.status_code == 201, response.text
    return response.json(), customer


def test_creation_idempotency_pair_uniqueness_and_event_privacy(
    api, ready_vendor, database_sandbox
):
    headers = customer_headers(api)
    key = str(uuid4())
    first = create_request(api, headers, ready_vendor[0]["id"], key=key)
    assert first.status_code == 201, first.text
    row = first.json()
    assert row["status"] == "PENDING" and row["version"] == 1
    assert row["allowed_actions"] == ["cancel"]
    replay = create_request(api, headers, ready_vendor[0]["id"], key=key)
    assert replay.status_code == 201 and replay.json()["id"] == row["id"]
    assert (
        create_request(
            api,
            headers,
            ready_vendor[0]["id"],
            key=key,
            meeting_label="A different place",
        ).status_code
        == 409
    )
    assert create_request(api, headers, ready_vendor[0]["id"]).status_code == 409
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 1
        metadata = connection.scalar(text("SELECT metadata FROM request_events"))
        assert metadata == {} and "meeting_point" not in metadata


def test_request_payload_and_creation_permissions(api, vendor, ready_vendor):
    assert create_request(api, vendor, ready_vendor[0]["id"]).status_code == 403
    customer = customer_headers(api)
    assert (
        create_request(
            api, customer, ready_vendor[0]["id"], customer_id=str(uuid4())
        ).status_code
        == 422
    )
    assert (
        create_request(
            api,
            customer,
            ready_vendor[0]["id"],
            meeting_point={"latitude": 14, "longitude": 80.27},
        ).status_code
        == 422
    )
    assert (
        api.post(
            "/api/v1/requests",
            headers=customer,
            json={
                "vendor_id": ready_vendor[0]["id"],
                "meeting_point": {"latitude": 13.08, "longitude": 80.27},
            },
        ).status_code
        == 422
    )


def test_tracking_is_private_before_acceptance_and_revoked_at_termination(
    api, vendor, pending
):
    visit, customer = pending
    path = f"/api/v1/requests/{visit['id']}/vendor-location"
    assert api.get(path, headers=customer).status_code == 409
    register(api, email="outsider@example.com")
    outsider = bearer(login(api, "outsider@example.com").json())
    assert api.get(path, headers=outsider).status_code == 404
    assert (
        api.get(f"/api/v1/requests/{visit['id']}", headers=outsider).status_code == 404
    )
    accepted = action(api, visit, vendor, "accept")
    assert accepted.status_code == 200
    tracking = api.get(path, headers=customer)
    assert tracking.status_code == 200 and tracking.json()["longitude"] == 80.2707
    assert action(api, accepted.json(), customer, "cancel").status_code == 200
    assert api.get(path, headers=customer).status_code == 409


@pytest.mark.parametrize(
    "name,actor", [("decline", "vendor"), ("cancel", "vendor"), ("cancel", "customer")]
)
def test_pending_terminal_transitions_are_one_use(
    api, vendor, pending, name, actor, database_sandbox
):
    visit, customer = pending
    headers = vendor if actor == "vendor" else customer
    response = action(api, visit, headers, name)
    assert response.status_code == 200
    assert response.json()["status"] == (
        "DECLINED" if name == "decline" else "CANCELLED"
    )
    assert response.json()["allowed_actions"] == []
    assert action(api, response.json(), headers, name).status_code == 409
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 2


def test_version_and_transition_actor_are_enforced(api, vendor, pending):
    visit, customer = pending
    assert action(api, visit, customer, "accept").status_code == 403
    assert action(api, visit, vendor, "complete").status_code == 409
    accepted = action(api, visit, vendor, "accept").json()
    assert accepted["version"] == 2
    assert action(api, visit, vendor, "decline").status_code == 409
    approached = action(api, accepted, vendor, "approach")
    assert (
        approached.status_code == 200 and approached.json()["status"] == "APPROACHING"
    )
    assert action(api, approached.json(), vendor, "complete").status_code == 409


def test_pending_expiry_is_evaluated_before_acceptance(
    api, vendor, pending, database_sandbox
):
    visit, customer = pending
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE visit_requests SET created_at=now()-interval '10 minutes',expires_at=now()-interval '1 second'"
            )
        )
    assert action(api, visit, vendor, "accept").status_code == 409
    current = api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()
    assert current["status"] == "EXPIRED" and current["version"] == 2
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 2


def test_acceptance_sets_sixty_minute_deadline_and_lists_are_scoped(
    api, vendor, pending
):
    from datetime import datetime

    visit, customer = pending
    assert (
        datetime.fromisoformat(visit["expires_at"])
        - datetime.fromisoformat(visit["created_at"])
    ).total_seconds() == pytest.approx(300, abs=1)
    accepted = action(api, visit, vendor, "accept").json()
    assert (
        datetime.fromisoformat(accepted["expires_at"])
        - datetime.fromisoformat(accepted["updated_at"])
    ).total_seconds() == pytest.approx(3600, abs=1)
    for headers in (vendor, customer):
        result = api.get("/api/v1/requests", headers=headers)
        assert (
            result.status_code == 200 and result.json()["items"][0]["id"] == visit["id"]
        )
    register(api, email="history-outsider@example.com")
    outsider = bearer(login(api, "history-outsider@example.com").json())
    assert api.get("/api/v1/requests", headers=outsider).json()["items"] == []


def test_report_is_participant_only_and_staff_resolution_is_audited(
    api, pending, operator, database_sandbox
):
    visit, customer = pending
    report = api.post(
        f"/api/v1/requests/{visit['id']}/reports",
        headers=customer,
        json={
            "category": "SAFETY",
            "reason": "Please review this synthetic safety concern.",
        },
    )
    assert report.status_code == 201
    assert api.get("/api/v1/admin/reports", headers=customer).status_code == 403
    queue = api.get("/api/v1/admin/reports", headers=operator)
    assert (
        queue.status_code == 200
        and queue.json()["items"][0]["id"] == report.json()["id"]
    )
    resolution = api.post(
        f"/api/v1/admin/reports/{report.json()['id']}/resolution",
        headers=operator,
        json={"reason": "Reviewed synthetic evidence and closed the report."},
    )
    assert resolution.status_code == 200 and resolution.json()["status"] == "RESOLVED"
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM admin_audit_records WHERE action='REPORT_RESOLVED'"
                )
            )
            == 1
        )


def test_customer_can_cancel_when_vendor_account_is_suspended(
    api, vendor, pending, operator
):
    visit, customer = pending
    owner = api.get("/api/v1/users/me", headers=vendor).json()["id"]
    assert (
        api.post(
            f"/api/v1/admin/users/{owner}/suspension",
            headers=operator,
            json={
                "suspended": True,
                "reason": "Investigating an account safety report",
            },
        ).status_code
        == 200
    )
    assert action(api, visit, customer, "cancel").status_code == 200


def test_admin_can_cancel_suspended_vendor_request_and_action_is_audited(
    api, vendor, pending, operator, database_sandbox
):
    visit, customer = pending
    owner = api.get("/api/v1/users/me", headers=vendor).json()["id"]
    assert (
        api.post(
            f"/api/v1/admin/users/{owner}/suspension",
            headers=operator,
            json={
                "suspended": True,
                "reason": "Investigating an account safety report",
            },
        ).status_code
        == 200
    )
    response = api.post(
        f"/api/v1/admin/requests/{visit['id']}/cancel",
        headers=operator,
        json={
            "expected_version": visit["version"],
            "reason": "Staff safety intervention",
        },
    )
    assert response.status_code == 200 and response.json()["status"] == "CANCELLED"
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM admin_audit_records WHERE action='REQUEST_CANCELLED'"
                )
            )
            == 1
        )


def test_expired_tracking_read_records_expiry_before_rejecting_point(
    api, vendor, pending, database_sandbox
):
    visit, customer = pending
    assert action(api, visit, vendor, "accept").status_code == 200
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE visit_requests SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 second'"
            )
        )
    assert (
        api.get(
            f"/api/v1/requests/{visit['id']}/vendor-location", headers=customer
        ).status_code
        == 409
    )
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT status FROM visit_requests")) == "EXPIRED"
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 3


def test_admin_request_inspection_is_audited(api, pending, operator, database_sandbox):
    visit, _ = pending
    assert (
        api.get(f"/api/v1/requests/{visit['id']}", headers=operator).status_code == 200
    )
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM admin_audit_records WHERE action='REQUEST_VIEWED'"
                )
            )
            == 1
        )


def test_vendor_capacity_bounds_arrival_work_and_does_not_break_creation_retry(
    api, pending, database_sandbox
):
    visit, owner = pending
    # Inject only the new policy setting so the RED observes missing enforcement, not a missing field.
    object.__setattr__(api.app.state.settings, "vendor_active_request_limit", 1)
    register(api, email="capacity-customer@example.com")
    customer = bearer(login(api, "capacity-customer@example.com").json())
    response = create_request(api, customer, visit["vendor_id"])
    assert (
        response.status_code == 409
        and response.json()["error"]["code"] == "VENDOR_CAPACITY_REACHED"
    )
    with database_sandbox.engine.connect() as connection:
        key = connection.scalar(
            text("SELECT idempotency_key FROM visit_requests WHERE id=:id"),
            {"id": visit["id"]},
        )
    retry = create_request(api, owner, visit["vendor_id"], key=str(key))
    assert retry.status_code == 201 and retry.json()["id"] == visit["id"]
