"""Own-account writes cannot change identity, role or another account."""

import pytest

from test_auth import PASSWORD, api, bearer, login, register

pytestmark = pytest.mark.integration


def test_own_profile_updates_only_allowed_fields(api):
    register(api)
    headers = bearer(login(api).json())
    response = api.patch("/api/v1/users/me", headers=headers,
                         json={"display_name": "Updated", "preferred_language": "ta"})
    assert response.status_code == 200
    assert response.json()["preferred_language"] == "ta"
    assert api.patch("/api/v1/users/me", headers=headers, json={"role": "admin"}).status_code == 422


def test_account_deletion_revokes_access_and_requires_confirmation(api):
    register(api)
    tokens = login(api).json()
    headers = bearer(tokens)
    assert api.request("DELETE", "/api/v1/users/me", headers=headers,
                       json={"confirmation": "no"}).status_code == 422
    response = api.request("DELETE", "/api/v1/users/me", headers=headers,
                           json={"confirmation": "DELETE"})
    assert response.status_code == 202
    assert api.get("/api/v1/users/me", headers=headers).status_code == 401
    assert login(api).status_code == 401
