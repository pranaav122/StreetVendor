import json

import pytest
from pydantic import ValidationError
from sqlalchemy import text

from app.config import Settings
from test_auth import api
from test_vendors import categories, fix, operator, vendor
from test_locations import ready_vendor

AREA = json.dumps({"type": "Polygon", "coordinates": [[[80.26,13.07],[80.29,13.07],
                  [80.29,13.10],[80.26,13.10],[80.26,13.07]]]})


@pytest.mark.parametrize("area", ["not-json", "{}", '{"type":"Point","coordinates":[80.27,13.08]}',
    '{"type":"Polygon","coordinates":[[[NaN,13],[80,13],[80,14],[NaN,13]]]}'])
def test_service_area_configuration_rejects_bad_geometry_format(area):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, postgres_password="test-only-password", service_area_geojson=area)


@pytest.mark.integration
def test_production_polygon_controls_real_postgis_updates(api, vendor, ready_vendor, database_sandbox):
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE users SET email_verified_at=now()"))
    api.app.state.settings.environment = "production"
    api.app.state.settings.service_area_geojson = AREA
    assert api.put("/api/v1/vendors/me/location", headers=vendor, json=fix(longitude=80.271)).status_code == 200
    assert api.put("/api/v1/vendors/me/location", headers=vendor, json=fix(latitude=13.15)).status_code == 422


@pytest.mark.integration
def test_invalid_polygon_is_a_safe_configuration_error(api, vendor, ready_vendor, database_sandbox):
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE users SET email_verified_at=now()"))
    api.app.state.settings.environment = "production"
    # A closed bow-tie ring is valid JSON but not a valid service-area polygon.
    api.app.state.settings.service_area_geojson = json.dumps({"type":"Polygon", "coordinates":[[
        [80.26,13.07],[80.29,13.10],[80.26,13.10],[80.29,13.07],[80.26,13.07]]]})
    response = api.put("/api/v1/vendors/me/location", headers=vendor, json=fix())
    assert response.status_code == 503 and response.json()["error"]["code"] == "SERVICE_AREA_INVALID"
