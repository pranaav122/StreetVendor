import pytest
from sqlalchemy import text

from test_auth import api
from test_vendors import (
    categories,
    customer_headers,
    online,
    operator,
    profile,
    vendor,
    verified,
)
from test_locations import ready_vendor
from test_visits import pending

pytestmark = pytest.mark.integration
REASON = {
    "reason": "Staff reviewed the suspension and requested a fresh business review."
}


def test_reinstatement_requires_staff_and_returns_pending_without_location(
    api, vendor, operator, categories, database_sandbox
):
    row = verified(api, vendor, operator, categories)
    assert online(api, vendor).status_code == 200
    assert (
        api.post(
            f"/api/v1/admin/vendors/{row['id']}/suspension",
            headers=operator,
            json=REASON,
        ).status_code
        == 200
    )
    path = f"/api/v1/admin/vendors/{row['id']}/reinstatement"
    assert api.post(path, headers=vendor, json=REASON).status_code == 403
    response = api.post(path, headers=operator, json=REASON)
    assert response.status_code == 200
    assert (
        response.json()["verification_status"] == "PENDING"
        and not response.json()["is_available"]
    )
    assert online(api, vendor).status_code == 403
    assert (
        api.post(
            "/api/v1/vendors/me/verifications",
            headers=vendor,
            json={
                "evidence_note": "Updated business metadata following the staff review"
            },
        ).status_code
        == 201
    )
    assert api.post(path, headers=operator, json=REASON).status_code == 409
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM admin_audit_records WHERE action='VENDOR_REINSTATED'"
                )
            )
            == 1
        )


def test_staff_can_suspend_business_of_inactive_owner_without_losing_own_session(
    api, vendor, operator, categories
):
    row = profile(api, vendor, categories)
    assert (
        api.post(
            f"/api/v1/admin/users/{row['user_id']}/suspension",
            headers=operator,
            json=REASON | {"suspended": True},
        ).status_code
        == 200
    )
    response = api.post(
        f"/api/v1/admin/vendors/{row['id']}/suspension", headers=operator, json=REASON
    )
    assert (
        response.status_code == 200
        and response.json()["verification_status"] == "SUSPENDED"
    )
    assert (
        api.post(
            f"/api/v1/admin/vendors/{row['id']}/reinstatement",
            headers=operator,
            json=REASON,
        ).status_code
        == 409
    )
    assert api.get("/api/v1/users/me", headers=operator).status_code == 200


def test_inactive_review_target_is_conflict_and_deleted_target_leaves_queue(
    api, vendor, operator, categories
):
    row = profile(api, vendor, categories)
    assert (
        api.post(
            "/api/v1/vendors/me/verifications",
            headers=vendor,
            json={"evidence_note": "My business note for staff review"},
        ).status_code
        == 201
    )
    assert (
        api.post(
            f"/api/v1/admin/users/{row['user_id']}/suspension",
            headers=operator,
            json=REASON | {"suspended": True},
        ).status_code
        == 200
    )
    response = api.post(
        f"/api/v1/admin/vendors/{row['id']}/verification",
        headers=operator,
        json={"decision": "VERIFIED"} | REASON,
    )
    assert (
        response.status_code == 409
        and response.json()["error"]["code"] == "TARGET_ACCOUNT_INACTIVE"
    )


def test_deleted_business_is_absent_from_staff_review_queue(
    api, vendor, operator, categories
):
    row = profile(api, vendor, categories)
    assert (
        api.post(
            "/api/v1/vendors/me/verifications",
            headers=vendor,
            json={"evidence_note": "My business note for staff review"},
        ).status_code
        == 201
    )
    assert (
        api.request(
            "DELETE",
            "/api/v1/users/me",
            headers=vendor,
            json={"confirmation": "DELETE"},
        ).status_code
        == 202
    )
    response = api.get("/api/v1/admin/verifications", headers=operator)
    assert response.status_code == 200 and response.json()["items"] == []
    assert (
        api.post(
            f"/api/v1/admin/vendors/{row['id']}/verification",
            headers=operator,
            json={"decision": "VERIFIED"} | REASON,
        ).status_code
        == 404
    )


def test_staff_and_vendor_summaries_count_visits_and_reports_not_sales(
    api, vendor, operator, pending, database_sandbox
):
    visit, customer = pending
    assert api.get("/api/v1/admin/summary", headers=customer).status_code == 403
    assert api.get("/api/v1/vendors/me/summary", headers=customer).status_code == 403
    assert (
        api.post(
            f"/api/v1/requests/{visit['id']}/reports",
            headers=customer,
            json={
                "category": "OTHER",
                "reason": "A synthetic report for statistics verification.",
            },
        ).status_code
        == 201
    )
    summary = api.get("/api/v1/admin/summary", headers=operator)
    assert summary.status_code == 200
    assert (
        summary.json()["active_visits"]
        == summary.json()["verified_vendors"]
        == summary.json()["open_reports"]
        == 1
    )
    own = api.get("/api/v1/vendors/me/summary", headers=vendor)
    assert own.status_code == 200 and own.json()["pending_visits"] == 1
    # Read-model fixture checks the pilot-day boundary independently of the tested state machine.
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE visit_requests SET status='COMPLETED',closed_at=(date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')+interval '1 hour'"
            )
        )
    own = api.get("/api/v1/vendors/me/summary", headers=vendor).json()
    assert own["completed_visits_today"] == 1 and own["day_timezone"] == "Asia/Kolkata"
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE visit_requests SET closed_at=(date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')-interval '1 second'"
            )
        )
    assert (
        api.get("/api/v1/vendors/me/summary", headers=vendor).json()[
            "completed_visits_today"
        ]
        == 0
    )
    assert "sales" not in summary.json()
