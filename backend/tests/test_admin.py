import pytest
from sqlalchemy import text

from test_auth import api
from test_vendors import categories, customer_headers, fix, online, operator, profile, vendor, verified

pytestmark = pytest.mark.integration


def test_only_operator_can_review_and_queue_is_bounded(api, vendor):
    assert api.get("/api/v1/admin/verifications", headers=vendor).status_code == 403
    assert api.get("/api/v1/admin/verifications", headers=customer_headers(api)).status_code == 403


def test_review_and_suspension_are_audited_and_hide_location(api, vendor, operator, categories, database_sandbox):
    row = verified(api, vendor, operator, categories)
    assert online(api, vendor).status_code == 200
    response = api.post(f"/api/v1/admin/vendors/{row['id']}/suspension", headers=operator,
                        json={"reason": "Safety report requires investigation."})
    assert response.status_code == 200
    assert response.json()["verification_status"] == "SUSPENDED"
    assert not response.json()["is_available"]
    assert online(api, vendor).status_code == 403
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0
        assert connection.scalar(text("SELECT count(*) FROM admin_audit_records")) == 2


def test_suspended_account_loses_existing_session(api, vendor, operator, categories):
    profile(api, vendor, categories)
    user_id = api.get("/api/v1/users/me", headers=vendor).json()["id"]
    response = api.post(f"/api/v1/admin/users/{user_id}/suspension", headers=operator,
                        json={"suspended": True, "reason": "Investigating reported account misuse."})
    assert response.status_code == 200
    assert api.get("/api/v1/users/me", headers=vendor).status_code == 401


def test_operator_cannot_suspend_self(api, operator):
    user_id = api.get("/api/v1/users/me", headers=operator).json()["id"]
    assert api.post(f"/api/v1/admin/users/{user_id}/suspension", headers=operator,
                    json={"suspended": True, "reason": "Accidental self suspension"}).status_code == 403


def test_even_an_operator_cannot_approve_own_vendor_profile(api, vendor, categories, database_sandbox):
    row = profile(api, vendor, categories)
    assert api.post("/api/v1/vendors/me/verifications", headers=vendor,
                    json={"evidence_note": "My business metadata for staff review"}).status_code == 201
    with database_sandbox.engine.begin() as connection:
        # Model a future trusted role change; authorization must still reject self-review.
        connection.execute(text("UPDATE users SET role='admin' WHERE id=:id"), {"id": row["user_id"]})
    assert api.post(f"/api/v1/admin/vendors/{row['id']}/verification", headers=vendor,
                    json={"decision": "VERIFIED", "reason": "Attempting to approve my own business"}).status_code == 403
