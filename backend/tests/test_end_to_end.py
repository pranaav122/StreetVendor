"""A complete synthetic visit through HTTP handlers and a disposable real database."""

from datetime import timedelta

import pytest

from app.auth.security import utcnow
from test_auth import api, bearer, login, register
from test_vendors import categories, customer_headers, operator, vendor
from test_locations import ready_vendor
from test_visits import action, create_request
from test_arrival import send_fix
from test_devices import register_device
from test_outbox import RecordingProvider, dispatch

pytestmark = pytest.mark.integration


def test_customer_partner_visit_with_isolation_and_notification(
    api, vendor, ready_vendor, monkeypatch
):
    # Fixtures register both roles, create the catalogue and approve the vendor
    # through the real staff HTTP endpoint before sharing the first usable fix.
    customer = customer_headers(api)
    register(api, email="outsider@example.com")
    outsider = bearer(login(api, "outsider@example.com").json())
    assert register_device(api, vendor, kind="vendor")[0].status_code == 200

    discovery = api.get(
        "/api/v1/vendors/nearby",
        headers=customer,
        params={"latitude": 13.0827, "longitude": 80.2707, "radius_m": 1500},
    )
    assert discovery.status_code == 200
    found = discovery.json()["items"][0]
    assert found["vendor_id"] == ready_vendor[0]["id"]
    assert "accuracy_m" not in found

    created = create_request(api, customer, found["vendor_id"])
    assert created.status_code == 201
    visit = created.json()
    path = f"/api/v1/requests/{visit['id']}"
    assert api.get(path, headers=outsider).status_code == 404
    assert api.get(path + "/vendor-location", headers=customer).status_code == 409
    provider = RecordingProvider()
    assert dispatch(api, provider).accepted == 1
    assert set(provider.messages[0]["data"]) == {
        "notification_id",
        "request_id",
        "event_type",
    }

    accepted = action(api, visit, vendor, "accept")
    assert accepted.status_code == 200
    assert api.get(path + "/vendor-location", headers=customer).status_code == 200
    assert api.get(path + "/vendor-location", headers=outsider).status_code == 404

    # Advance both capture and server clocks rather than sleeping or pretending
    # two back-to-back uploads prove five seconds of presence at the meeting point.
    clock = utcnow()
    assert send_fix(api, vendor, clock, monkeypatch).status_code == 200
    assert (
        send_fix(api, vendor, clock + timedelta(seconds=6), monkeypatch).status_code
        == 200
    )
    arrived = api.get(path, headers=customer).json()
    assert arrived["status"] == "ARRIVED"
    completed = action(api, arrived, vendor, "complete")
    assert completed.status_code == 200
    assert completed.json()["status"] == "COMPLETED"
    assert api.get(path + "/vendor-location", headers=customer).status_code == 409
    assert api.get(path, headers=outsider).status_code == 404
