"""Exercise authentication through real HTTP handlers and a disposable PostgreSQL DB."""

from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
import time

import pytest
from alembic import command
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text

from app.main import create_app

pytestmark = pytest.mark.integration
PASSWORD = "a-private-test-password-482"


@pytest.fixture
def api(database_sandbox, alembic_config):
    with database_sandbox.engine.begin() as connection:
        alembic_config.attributes["connection"] = connection
        command.upgrade(alembic_config, "head")
    settings = database_sandbox.settings.model_copy(update={
        "jwt_secret": SecretStr("test-signing-key-" + "7" * 48),
        "auth_login_limit": 3,
        "jobs_enabled": False,
    })
    with TestClient(create_app(settings)) as client:
        yield client


def register(api, role="customer", email="person@example.com"):
    return api.post(f"/api/v1/auth/register/{role}", json={
        "email": email, "password": PASSWORD, "display_name": "Test Person",
        "preferred_language": "en",
    })


def login(api, email="person@example.com", password=PASSWORD):
    return api.post("/api/v1/auth/login", json={"email": email, "password": password})


def bearer(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_registration_fixes_role_and_hashes_password(api, database_sandbox):
    response = register(api, "vendor", "MixedCase@EXAMPLE.COM")
    assert response.status_code == 201
    assert response.json()["role"] == "vendor"
    assert response.json()["email"] == "mixedcase@example.com"
    assert "password" not in response.text
    with database_sandbox.engine.connect() as connection:
        stored = connection.scalar(text("SELECT password_hash FROM user_credentials"))
    assert stored.startswith("$argon2id$")
    assert PASSWORD not in stored


def test_registration_does_not_accept_admin_role_or_unknown_fields(api):
    payload = {"email": "evil@example.com", "password": PASSWORD,
               "display_name": "Person", "role": "admin"}
    response = api.post("/api/v1/auth/register/customer", json=payload)
    assert response.status_code == 422
    assert PASSWORD not in response.text
    assert api.post("/api/v1/auth/register/admin", json=payload).status_code == 404


def test_duplicate_normalized_email_conflicts(api):
    assert register(api).status_code == 201
    assert register(api, email="PERSON@example.com").status_code == 409


def test_public_template_signing_key_cannot_enable_authentication(api):
    api.app.state.settings.jwt_secret = SecretStr("replace-with-a-random-signing-key-at-least-32-characters")
    assert register(api).status_code == 503


def test_login_and_own_profile(api):
    assert register(api).status_code == 201
    response = login(api)
    assert response.status_code == 200
    tokens = response.json()
    assert tokens["expires_in"] == 600
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"] != tokens["refresh_token"]
    profile = api.get("/api/v1/users/me", headers=bearer(tokens))
    assert profile.status_code == 200
    assert profile.json()["email"] == "person@example.com"
    assert "password" not in profile.text


def test_wrong_password_and_unknown_email_are_indistinguishable(api):
    register(api)
    wrong = login(api, password="wrong-test-password")
    unknown = login(api, email="missing@example.com", password="wrong-test-password")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["error"]["code"] == unknown.json()["error"]["code"]
    assert wrong.headers["www-authenticate"] == "Bearer"


def test_login_is_rate_limited_in_postgresql(api):
    register(api)
    for _ in range(3):
        assert login(api, password="wrong-test-password").status_code == 401
    blocked = login(api)
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


def test_refresh_rotates_and_reuse_revokes_the_family(api):
    register(api)
    original = login(api).json()
    refreshed = api.post("/api/v1/auth/refresh", json={"refresh_token": original["refresh_token"]})
    assert refreshed.status_code == 200
    replacement = refreshed.json()
    assert replacement["refresh_token"] != original["refresh_token"]
    assert api.get("/api/v1/users/me", headers=bearer(replacement)).status_code == 200
    assert api.post("/api/v1/auth/refresh", json={"refresh_token": original["refresh_token"]}).status_code == 401
    assert api.get("/api/v1/users/me", headers=bearer(replacement)).status_code == 401


def test_logout_revokes_only_the_acting_family(api):
    register(api)
    first, second = login(api).json(), login(api).json()
    assert api.post("/api/v1/auth/logout", headers=bearer(first)).status_code == 204
    assert api.get("/api/v1/users/me", headers=bearer(first)).status_code == 401
    assert api.get("/api/v1/users/me", headers=bearer(second)).status_code == 200


def test_logout_all_revokes_every_family(api):
    register(api)
    first, second = login(api).json(), login(api).json()
    assert api.post("/api/v1/auth/logout-all", headers=bearer(first)).status_code == 204
    assert api.get("/api/v1/users/me", headers=bearer(second)).status_code == 401


def test_expired_refresh_and_suspended_account_fail(api, database_sandbox):
    register(api)
    tokens = login(api).json()
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE refresh_sessions SET expires_at=:past"),
                           {"past": datetime.now(timezone.utc)-timedelta(seconds=1)})
    assert api.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE users SET status='SUSPENDED'"))
    assert login(api).status_code == 401


def test_missing_invalid_and_expired_access_fail(api):
    import jwt

    register(api)
    assert api.get("/api/v1/users/me").status_code == 401
    assert api.get("/api/v1/users/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    tokens = login(api).json()
    claims = jwt.decode(tokens["access_token"], options={"verify_signature": False})
    claims["exp"] = int(datetime.now(timezone.utc).timestamp())-1
    expired = jwt.encode(claims, "test-signing-key-"+"7"*48, algorithm="HS256")
    assert api.get("/api/v1/users/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_refresh_tokens_are_stored_only_as_hashes(api, database_sandbox):
    register(api)
    tokens = login(api).json()
    with database_sandbox.engine.connect() as connection:
        stored = connection.scalar(text("SELECT token_hash FROM refresh_sessions"))
    assert len(stored) == 32
    assert tokens["refresh_token"].encode() not in bytes(stored)


def test_logout_wins_over_a_refresh_already_waiting_for_a_row_lock(api, database_sandbox):
    register(api)
    tokens = login(api).json()

    def wait_for_blocked_calls(count):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            with database_sandbox.engine.connect() as monitor:
                blocked = monitor.scalar(text(
                    "SELECT count(*) FROM pg_stat_activity WHERE datname=:database "
                    "AND wait_event_type='Lock'"), {"database": database_sandbox.settings.postgres_db})
            if blocked >= count:
                return
            time.sleep(0.02)
        raise AssertionError("Concurrent requests did not reach the intended lock boundary.")

    # Hold the old refresh row so logout begins before the new child is committed.
    with ThreadPoolExecutor(max_workers=2) as executor:
        with database_sandbox.engine.begin() as blocker:
            blocker.execute(text("SELECT id FROM refresh_sessions FOR UPDATE"))
            refreshed = executor.submit(api.post, "/api/v1/auth/refresh",
                                        json={"refresh_token": tokens["refresh_token"]})
            wait_for_blocked_calls(1)
            logged_out = executor.submit(api.post, "/api/v1/auth/logout", headers=bearer(tokens))
            wait_for_blocked_calls(2)
        response = refreshed.result(timeout=10)
        assert response.status_code == 200
        assert logged_out.result(timeout=10).status_code == 204
    assert api.get("/api/v1/users/me", headers=bearer(response.json())).status_code == 401
