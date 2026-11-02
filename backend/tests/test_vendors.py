"""Profiles and availability use real HTTP, migrations and PostGIS writes."""
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
import time
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.schemas import RegisterInput
from app.auth.security import utcnow
from app.auth.service import register_user
from test_auth import PASSWORD, api, bearer, login, register

pytestmark = pytest.mark.integration


@pytest.fixture
def vendor(api):
    register(api, "vendor", "vendor@example.com")
    return bearer(login(api, "vendor@example.com").json())


@pytest.fixture
def operator(api, database_sandbox):
    with Session(database_sandbox.engine) as session:
        register_user(session, RegisterInput(email="staff@example.com", password=PASSWORD,
                      display_name="Staff"), "admin")
    return bearer(login(api, "staff@example.com").json())


@pytest.fixture
def categories(api):
    from app.vendors.service import seed_categories
    with api.app.state.session_factory() as session:
        seed_categories(session)
        seed_categories(session)
    return api.get("/api/v1/categories", headers=customer_headers(api)).json()["items"]


def customer_headers(api):
    register(api, email="customer@example.com")
    return bearer(login(api, "customer@example.com").json())


def profile(api, vendor, categories):
    response = api.put("/api/v1/vendors/me/profile", headers=vendor, json={
        "display_name": "Fresh vegetables", "description": "Local produce",
        "category_ids": [categories[0]["id"]],
    })
    assert response.status_code == 200, response.text
    return response.json()


def verified(api, vendor, operator, categories):
    row = profile(api, vendor, categories)
    submission = api.post("/api/v1/vendors/me/verifications", headers=vendor,
                          json={"evidence_note": "Staff can review my stall at the local market."})
    assert submission.status_code == 201, submission.text
    response = api.post(f"/api/v1/admin/vendors/{row['id']}/verification", headers=operator,
                        json={"decision": "VERIFIED", "reason": "Staff checked the business metadata."})
    assert response.status_code == 200, response.text
    return response.json()


def fix(**updates):
    result = {"latitude": 13.0827, "longitude": 80.2707,
              "accuracy_m": 10, "captured_at": utcnow().isoformat()}
    return result | updates


def online(api, vendor):
    return api.patch("/api/v1/vendors/me/availability", headers=vendor, json={
        "is_available": True, "location_sharing_enabled": True, "location": fix(),
    })


def test_categories_require_auth_and_seed_is_idempotent(api, monkeypatch, database_sandbox):
    assert api.get("/api/v1/categories").status_code == 401
    from app import cli
    monkeypatch.setattr(cli, "Settings", lambda: database_sandbox.settings)
    assert cli.main(["seed-categories"]) == cli.main(["seed-categories"]) == 0
    response = api.get("/api/v1/categories", headers=customer_headers(api))
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 3 and len({x["slug"] for x in items}) == len(items)
    assert all(x["name_en"] and x["name_ta"] for x in items)
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE product_categories SET is_active=false WHERE id=:id"), {"id": items[0]["id"]})
    assert len(api.get("/api/v1/categories", headers=customer_headers(api)).json()["items"]) == len(items)-1


def test_vendor_owns_profile_and_cannot_self_approve(api, vendor):
    response = api.put("/api/v1/vendors/me/profile", headers=vendor, json={
        "display_name": "Bad", "description": "", "category_ids": [str(uuid4())],
        "verification_status": "VERIFIED", "user_id": str(uuid4()),
    })
    assert response.status_code == 422
    assert api.get("/api/v1/vendors/me", headers=customer_headers(api)).status_code == 403


def test_profile_pending_and_public_view_omits_identity(api, vendor, categories):
    row = profile(api, vendor, categories)
    assert row["verification_status"] == "PENDING" and not row["is_available"]
    public = api.get(f"/api/v1/vendors/{row['id']}", headers=customer_headers(api))
    assert public.status_code == 200
    assert not {"user_id", "email", "position", "password_hash"} & public.json().keys()
    assert online(api, vendor).status_code == 403


def test_online_requires_verified_first_fix_and_offline_deletes_it(api, vendor, operator, categories, database_sandbox):
    row = verified(api, vendor, operator, categories)
    assert api.patch("/api/v1/vendors/me/availability", headers=vendor,
                     json={"is_available": True, "location_sharing_enabled": True}).status_code == 422
    assert online(api, vendor).status_code == 200
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 1
        assert abs(connection.scalar(text("SELECT ST_X(position::geometry) FROM vendor_locations"))-80.2707) < .000001
    response = api.patch("/api/v1/vendors/me/availability", headers=vendor,
                         json={"is_available": False, "location_sharing_enabled": False})
    assert response.status_code == 200 and not response.json()["location_sharing_enabled"]
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0


@pytest.mark.parametrize("location", [fix(latitude=90), fix(accuracy_m=101),
    fix(captured_at=(utcnow()-timedelta(minutes=5)).isoformat()), fix(captured_at="2026-01-01T01:00:00")])
def test_bad_first_fix_does_not_partially_enable_sharing(api, vendor, operator, categories, location):
    verified(api, vendor, operator, categories)
    response = api.patch("/api/v1/vendors/me/availability", headers=vendor, json={
        "is_available": True, "location_sharing_enabled": True, "location": location})
    assert response.status_code == 422
    assert not api.get("/api/v1/vendors/me", headers=vendor).json()["is_available"]


def test_account_deletion_removes_vendor_point_and_public_name(api, vendor, operator, categories, database_sandbox):
    verified(api, vendor, operator, categories)
    assert online(api, vendor).status_code == 200
    assert api.request("DELETE", "/api/v1/users/me", headers=vendor, json={"confirmation": "DELETE"}).status_code == 202
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0
        assert connection.scalar(text("SELECT display_name FROM vendor_profiles")) == "Deleted vendor"


def test_production_business_access_requires_confirmed_email(api, vendor):
    api.app.state.settings.environment = "production"
    response = api.get("/api/v1/categories", headers=vendor)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "EMAIL_VERIFICATION_REQUIRED"


def test_offline_waits_for_inflight_online_then_erases_point(api, vendor, operator, categories, database_sandbox):
    verified(api, vendor, operator, categories)
    assert online(api, vendor).status_code == 200

    def wait_for_locks(count):
        deadline = time.monotonic() + 6
        while time.monotonic() < deadline:
            with database_sandbox.engine.connect() as connection:
                waiting = connection.scalar(text("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'"))
            if waiting >= count:
                return
            time.sleep(.03)
        raise AssertionError("Expected concurrent transactions to reach their row locks")

    with ThreadPoolExecutor(max_workers=2) as pool:
        with database_sandbox.engine.begin() as blocker:
            blocker.execute(text("SELECT vendor_id FROM vendor_locations FOR UPDATE"))
            enabling = pool.submit(online, api, vendor)
            wait_for_locks(1)
            disabling = pool.submit(api.patch, "/api/v1/vendors/me/availability", headers=vendor,
                                    json={"is_available": False, "location_sharing_enabled": False})
            wait_for_locks(2)
        assert enabling.result(timeout=10).status_code == 200
        assert disabling.result(timeout=10).status_code == 200
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0
        assert connection.scalar(text("SELECT is_available FROM vendor_profiles")) is False
