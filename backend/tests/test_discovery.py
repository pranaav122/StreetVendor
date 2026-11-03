from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.auth.security import utcnow
from test_auth import api, bearer, login, register
from test_vendors import categories, customer_headers, fix, operator, vendor, verified
from test_locations import ready_vendor

pytestmark = pytest.mark.integration
SEARCH = {"latitude": 13.0827, "longitude": 80.2707, "radius_m": 1500}


def test_nearby_is_customer_only_and_exposes_coarse_regions(api, vendor, ready_vendor):
    assert api.get("/api/v1/vendors/nearby", params=SEARCH, headers=vendor).status_code == 403
    response = api.get("/api/v1/vendors/nearby", params=SEARCH, headers=customer_headers(api))
    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["vendor_id"] == ready_vendor[0]["id"]
    assert item["approximate_location"] == {"latitude": 13.08, "longitude": 80.27, "radius_m": 1000}
    assert item["distance_band_m"] == {"min": 0, "max": 1000}
    assert "accuracy_m" not in item and "position" not in item and "email" not in item


@pytest.mark.parametrize("changes", [{"radius_m": 99}, {"radius_m": 5001}, {"limit": 51},
    {"latitude": "NaN"}, {"latitude": 13.8}, {"longitude": 200}])
def test_search_bounds_are_enforced(api, changes):
    response = api.get("/api/v1/vendors/nearby", params=SEARCH | changes, headers=customer_headers(api))
    assert response.status_code == 422
    error = response.json()["error"]
    if changes == {"latitude": 13.8}:
        assert error["code"] == "OUTSIDE_SERVICE_AREA"
    else:
        assert any(field["path"][-1] in changes for field in error["fields"])


@pytest.mark.parametrize("statement", [
    "UPDATE vendor_locations SET captured_at=now()-interval '91 seconds'",
    "UPDATE vendor_profiles SET is_available=false,location_sharing_enabled=false",
    "UPDATE vendor_profiles SET is_available=false,verification_status='REJECTED'",
    "UPDATE users SET status='SUSPENDED' WHERE role='vendor'",
])
def test_database_filters_unavailable_vendors(api, ready_vendor, database_sandbox, statement):
    headers = customer_headers(api)
    with database_sandbox.engine.begin() as connection:
        connection.execute(text(statement))
    response = api.get("/api/v1/vendors/nearby", params=SEARCH, headers=headers)
    assert response.status_code == 200 and response.json()["items"] == []


def test_category_filter_and_signed_search_bound_cursor(api, vendor, operator, categories, ready_vendor):
    register(api, "vendor", "second@example.com")
    second = bearer(login(api, "second@example.com").json())
    verified(api, second, operator, categories)
    assert api.patch("/api/v1/vendors/me/availability", headers=second, json={
        "is_available": True, "location_sharing_enabled": True, "location": fix()}).status_code == 200
    headers = customer_headers(api)
    first = api.get("/api/v1/vendors/nearby", params=SEARCH | {"limit": 1}, headers=headers)
    assert first.status_code == 200
    cursor = first.json()["next_cursor"]
    assert cursor and len(first.json()["items"]) == 1
    second_page = api.get("/api/v1/vendors/nearby", params=SEARCH | {"limit": 1, "cursor": cursor}, headers=headers)
    assert second_page.status_code == 200 and second_page.json()["next_cursor"] is None
    assert first.json()["items"][0]["vendor_id"] != second_page.json()["items"][0]["vendor_id"]
    for modified in (SEARCH | {"longitude": 80.271, "limit": 1, "cursor": cursor},
                     SEARCH | {"limit": 1, "cursor": cursor[:-3]+"xyz"}):
        assert api.get("/api/v1/vendors/nearby", params=modified, headers=headers).status_code == 422
    register(api, email="another-customer@example.com")
    other_customer = bearer(login(api, "another-customer@example.com").json())
    assert api.get("/api/v1/vendors/nearby", params=SEARCH | {"limit": 1, "cursor": cursor}, headers=other_customer).status_code == 422
    assert api.get("/api/v1/vendors/nearby", params=SEARCH | {"category_id": str(uuid4())}, headers=headers).json()["items"] == []


def test_spatial_prefilter_uses_gist_on_a_synthetic_catalogue(ready_vendor, database_sandbox):
    with database_sandbox.engine.begin() as connection:
        # Deterministic positions and disposable accounts keep the planner check repeatable.
        connection.execute(text("""
            WITH identities AS (SELECT gen_random_uuid() AS id FROM generate_series(1,4096)),
            accounts AS (INSERT INTO users(id,email,role,status,display_name,preferred_language)
                SELECT id,id::text||'@example.com','vendor','ACTIVE','Planner fixture','en' FROM identities RETURNING id),
            vendors AS (INSERT INTO vendor_profiles(id,user_id,display_name,description,verification_status,is_available,location_sharing_enabled)
                SELECT gen_random_uuid(),id,'Planner fixture','','VERIFIED',true,true FROM accounts RETURNING id),
            positions AS (SELECT id,row_number() OVER(ORDER BY id) AS n FROM vendors)
            INSERT INTO vendor_locations(vendor_id,position,accuracy_m,captured_at)
                SELECT id,ST_SetSRID(ST_MakePoint(80.15+(n%64)*0.003,13.0+(n/64)*0.003),4326)::geography,10,now() FROM positions
            """))
        connection.execute(text("ANALYZE vendor_locations"))
        plan = connection.scalar(text("EXPLAIN (ANALYZE,FORMAT JSON) SELECT vendor_id FROM vendor_locations WHERE ST_DWithin(position,ST_SetSRID(ST_MakePoint(80.27,13.08),4326)::geography,1500)"))
        import json
        serialized = json.dumps(plan)
        assert "ix_vendor_position" in serialized
        print("Spatial prefilter plan:", serialized)


def test_search_count_limit_is_persistent_and_returns_retry_hint(api):
    headers = customer_headers(api)
    for _ in range(60):
        assert api.get("/api/v1/vendors/nearby", params=SEARCH, headers=headers).status_code == 200
    response = api.get("/api/v1/vendors/nearby", params=SEARCH, headers=headers)
    assert response.status_code == 429 and response.headers["Retry-After"] == "900"


def test_distinct_coarse_origin_changes_are_bounded(api):
    headers = customer_headers(api)
    for index in range(10):
        assert api.get("/api/v1/vendors/nearby", params=SEARCH | {"longitude": 80.17+index*.01}, headers=headers).status_code == 200
    response = api.get("/api/v1/vendors/nearby", params=SEARCH | {"longitude": 80.28}, headers=headers)
    assert response.status_code == 429 and response.json()["error"]["code"] == "SEARCH_AREA_LIMIT"
