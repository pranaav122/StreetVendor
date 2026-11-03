from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
import time

import pytest
from sqlalchemy import text

from app.auth.security import utcnow
from test_auth import api
from test_vendors import categories, fix, operator, vendor, verified

pytestmark = pytest.mark.integration


@pytest.fixture
def ready_vendor(api, vendor, operator, categories):
    row = verified(api, vendor, operator, categories)
    initial = fix()
    response = api.patch("/api/v1/vendors/me/availability", headers=vendor, json={
        "is_available": True, "location_sharing_enabled": True, "location": initial})
    assert response.status_code == 200
    return row, initial


def test_monotonic_updates_and_only_latest_fix_is_kept(api, vendor, ready_vendor, database_sandbox):
    row, initial = ready_vendor
    update = fix(longitude=80.2717)
    response = api.put("/api/v1/vendors/me/location", headers=vendor, json=update)
    assert response.status_code == 200
    assert api.put("/api/v1/vendors/me/location", headers=vendor, json=update).status_code == 409
    assert api.put("/api/v1/vendors/me/location", headers=vendor, json=initial).status_code == 409
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 1
        assert connection.scalar(text("SELECT ST_X(position::geometry) FROM vendor_locations")) == 80.2717


@pytest.mark.parametrize("changes", [
    {"age_seconds": 180},
    {"age_seconds": -180},
    {"captured_at": "2026-11-02T01:00:00"}, {"accuracy_m": 101},
    {"latitude": 13.5}, {"longitude": -180}, {"accuracy_m": -1},
])
def test_invalid_updates_do_not_replace_good_point(api, vendor, ready_vendor, database_sandbox, changes):
    if "age_seconds" in changes:
        changes = {"captured_at": (utcnow()-timedelta(seconds=changes["age_seconds"])).isoformat()}
    response = api.put("/api/v1/vendors/me/location", headers=vendor, json=fix(**changes))
    assert response.status_code == 422
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT ST_X(position::geometry) FROM vendor_locations")) == 80.2707


@pytest.mark.parametrize("number", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_input_is_a_safe_validation_error(api, vendor, number):
    response = api.put("/api/v1/vendors/me/location", headers=vendor | {"Content-Type": "application/json"},
                      content='{"latitude":'+number+',"longitude":80.27,"accuracy_m":10,"captured_at":"2026-11-02T01:00:00Z"}')
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_offline_or_suspended_vendor_cannot_restore_point_with_update(api, vendor, operator, ready_vendor, database_sandbox):
    row, _ = ready_vendor
    assert api.patch("/api/v1/vendors/me/availability", headers=vendor,
                     json={"is_available": False, "location_sharing_enabled": False}).status_code == 200
    assert api.put("/api/v1/vendors/me/location", headers=vendor, json=fix()).status_code == 409
    assert api.post(f"/api/v1/admin/vendors/{row['id']}/suspension", headers=operator,
                    json={"reason": "Review pending after safety complaint"}).status_code == 200
    assert api.put("/api/v1/vendors/me/location", headers=vendor, json=fix()).status_code == 403
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0


def test_production_requires_explicit_service_area(api, vendor, ready_vendor, database_sandbox):
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE users SET email_verified_at=now()"))
    api.app.state.settings.environment = "production"
    response = api.put("/api/v1/vendors/me/location", headers=vendor, json=fix())
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_AREA_NOT_CONFIGURED"


def test_postgis_matches_independent_wolfram_metres(ready_vendor, database_sandbox):
    with database_sandbox.engine.connect() as connection:
        for longitude, expected in [(80.27115, 48.801925), (80.2717, 108.448723)]:
            distance = connection.scalar(text("SELECT ST_Distance(position, ST_SetSRID(ST_MakePoint(:lon,13.0827),4326)::geography) FROM vendor_locations"), {"lon": longitude})
            assert distance == pytest.approx(expected, abs=.02)


@pytest.mark.parametrize("action", ["offline", "suspension"])
def test_inflight_location_cannot_survive_later_privacy_action(api, vendor, operator, ready_vendor, database_sandbox, action):
    row, _ = ready_vendor

    def wait_for_locks(count):
        deadline = time.monotonic()+6
        while time.monotonic()<deadline:
            with database_sandbox.engine.connect() as connection:
                waiting = connection.scalar(text("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'"))
            if waiting >= count:
                return
            time.sleep(.03)
        raise AssertionError("Concurrent writes did not reach their expected locks")

    with ThreadPoolExecutor(max_workers=2) as pool:
        with database_sandbox.engine.begin() as blocker:
            blocker.execute(text("SELECT vendor_id FROM vendor_locations FOR UPDATE"))
            update = pool.submit(api.put, "/api/v1/vendors/me/location", headers=vendor, json=fix(longitude=80.271))
            wait_for_locks(1)
            if action == "offline":
                stop = pool.submit(api.patch, "/api/v1/vendors/me/availability", headers=vendor,
                                   json={"is_available": False, "location_sharing_enabled": False})
            else:
                stop = pool.submit(api.post, f"/api/v1/admin/vendors/{row['id']}/suspension", headers=operator,
                                   json={"reason": "Investigating safety report during tracking"})
            wait_for_locks(2)
        assert update.result(timeout=10).status_code == 200
        assert stop.result(timeout=10).status_code == 200
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0
    assert api.put("/api/v1/vendors/me/location", headers=vendor, json=fix()).status_code in (403,409)
