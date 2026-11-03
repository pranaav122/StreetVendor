import pytest

from test_auth import api
from test_vendors import categories, customer_headers, fix, operator, vendor
from test_locations import ready_vendor
from test_discovery import SEARCH

pytestmark = pytest.mark.integration


def test_small_search_changes_and_within_cell_motion_cannot_refine_public_point(api, vendor, ready_vendor):
    headers = customer_headers(api)
    initial = api.get("/api/v1/vendors/nearby", params=SEARCH, headers=headers)
    assert initial.status_code == 200
    before = initial.json()["items"][0]
    assert api.put("/api/v1/vendors/me/location", headers=vendor, json=fix(longitude=80.273)).status_code == 200
    changed = api.get("/api/v1/vendors/nearby", params=SEARCH | {"latitude": 13.0831, "radius_m": 100}, headers=headers)
    assert changed.status_code == 200
    after = changed.json()["items"][0]
    assert before["approximate_location"] == after["approximate_location"]
    assert before["distance_band_m"] == after["distance_band_m"]
