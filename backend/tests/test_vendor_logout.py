import pytest
from sqlalchemy import text

from test_auth import api, bearer, login
from test_vendors import categories, operator, vendor
from test_locations import ready_vendor
from test_visits import action, pending

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("endpoint", ["logout", "logout-all"])
def test_vendor_logout_erases_location_and_revokes_active_visit_tracking(
    api, vendor, pending, database_sandbox, endpoint
):
    visit, customer = pending
    assert action(api, visit, vendor, "accept").status_code == 200
    path = f"/api/v1/requests/{visit['id']}/vendor-location"
    assert api.get(path, headers=customer).status_code == 200
    headers = (
        vendor
        if endpoint == "logout"
        else bearer(login(api, "vendor@example.com").json())
    )
    assert api.post(f"/api/v1/auth/{endpoint}", headers=headers).status_code == 204
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0
        assert not connection.scalar(
            text("SELECT is_available OR location_sharing_enabled FROM vendor_profiles")
        )
    assert api.get(path, headers=customer).status_code == 409
