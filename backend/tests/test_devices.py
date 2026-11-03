from uuid import uuid4

import pytest
from sqlalchemy import text

from test_auth import api, bearer, login, register
from test_vendors import categories, operator, vendor, customer_headers
from test_locations import ready_vendor
from test_visits import action, pending

pytestmark = pytest.mark.integration
CUSTOMER_PROJECT = "11111111-1111-4111-8111-111111111111"
VENDOR_PROJECT = "22222222-2222-4222-8222-222222222222"


def register_device(api, headers, kind="customer", installation=None, token=None):
    installation = installation or str(uuid4())
    token = token or "ExpoPushToken[" + uuid4().hex + "]"
    response = api.put(
        f"/api/v1/devices/{installation}",
        headers=headers,
        json={
            "app_kind": kind,
            "platform": "android",
            "token": token,
            "project_id": CUSTOMER_PROJECT if kind == "customer" else VENDOR_PROJECT,
        },
    )
    return response, installation, token


def test_device_registration_is_role_bound_and_never_returns_push_address(
    api, database_sandbox
):
    register(api)
    headers = bearer(login(api).json())
    response, installation, token = register_device(api, headers)
    assert response.status_code == 200, response.text
    assert token not in response.text and response.json()["delivery_enabled"] is False
    assert register_device(api, headers, kind="vendor")[0].status_code == 403
    assert (
        register_device(api, headers, token="not-an-expo-token")[0].status_code == 422
    )
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM device_tokens")) == 1
    assert (
        api.delete(f"/api/v1/devices/{installation}", headers=headers).status_code
        == 204
    )
    assert (
        api.delete(f"/api/v1/devices/{installation}", headers=headers).status_code
        == 204
    )


def test_ownership_transfer_deletes_old_delivery_records_and_blocks_old_owner(
    api, vendor, pending, database_sandbox
):
    visit, owner = pending
    response, installation, token = register_device(api, owner)
    assert response.status_code == 200
    assert action(api, visit, vendor, "accept").status_code == 200
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM notification_outbox")) == 1
    new_user = register(api, email="next-device-owner@example.com").json()
    replacement = bearer(login(api, "next-device-owner@example.com").json())
    assert (
        register_device(api, replacement, installation=installation, token=token)[
            0
        ].status_code
        == 200
    )
    assert (
        api.delete(f"/api/v1/devices/{installation}", headers=owner).status_code == 404
    )
    with database_sandbox.engine.connect() as connection:
        assert (
            str(connection.scalar(text("SELECT user_id FROM device_tokens")))
            == new_user["id"]
        )
        assert connection.scalar(text("SELECT count(*) FROM notification_outbox")) == 0


def test_logout_disables_only_its_family_and_logout_all_disables_remaining_devices(
    api, database_sandbox
):
    register(api)
    first = login(api).json()
    second = login(api).json()
    assert register_device(api, bearer(first))[0].status_code == 200
    assert register_device(api, bearer(second))[0].status_code == 200
    assert api.post("/api/v1/auth/logout", headers=bearer(first)).status_code == 204
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM device_tokens WHERE disabled_at IS NULL")
            )
            == 1
        )
    assert (
        api.post("/api/v1/auth/logout-all", headers=bearer(second)).status_code == 204
    )
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM device_tokens WHERE disabled_at IS NULL")
            )
            == 0
        )


def test_production_project_binding_fails_closed(api, database_sandbox):
    user = register(api).json()
    headers = bearer(login(api).json())
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE users SET email_verified_at=now()"))
    api.app.state.settings.environment = "production"
    response, _, _ = register_device(api, headers)
    assert (
        response.status_code == 503
        and response.json()["error"]["code"] == "PUSH_PROJECT_NOT_CONFIGURED"
    )
    object.__setattr__(api.app.state.settings, "expo_customer_project_id", uuid4())
    assert register_device(api, headers)[0].status_code == 422


def test_account_suspension_immediately_disables_device_registration(
    api, operator, database_sandbox
):
    user = register(api).json()
    headers = bearer(login(api).json())
    assert register_device(api, headers)[0].status_code == 200
    assert (
        api.post(
            f"/api/v1/admin/users/{user['id']}/suspension",
            headers=operator,
            json={"suspended": True, "reason": "Synthetic account safety suspension"},
        ).status_code
        == 200
    )
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(
            text("SELECT disabled_at IS NOT NULL FROM device_tokens")
        )


def test_device_cap_is_bounded_but_existing_registration_can_refresh(api):
    register(api)
    headers = bearer(login(api).json())
    object.__setattr__(api.app.state.settings, "max_devices_per_user", 1)
    response, installation, token = register_device(api, headers)
    assert response.status_code == 200
    assert register_device(api, headers)[0].status_code == 409
    assert (
        register_device(api, headers, installation=installation, token=token)[
            0
        ].status_code
        == 200
    )
