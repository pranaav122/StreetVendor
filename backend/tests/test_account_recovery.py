import importlib.util
import re
from datetime import timedelta

import pytest
from sqlalchemy import text

from app.auth.security import utcnow
from test_auth import PASSWORD, api, bearer, login, register

pytestmark = pytest.mark.integration


class RecordingMailer:
    """Only the external delivery boundary is replaced; tokens/DB/HTTP stay real."""
    enabled = True

    def __init__(self):
        self.messages = []

    def send(self, recipient, subject, body):
        self.messages.append((recipient, subject, body))

    def last_token(self):
        return re.search(r"#token=([A-Za-z0-9_-]+)", self.messages[-1][2]).group(1)


@pytest.fixture
def mailbox(api):
    transport = RecordingMailer()
    api.app.state.mailer = transport
    return transport


def test_recovery_does_not_disclose_account_existence(api, mailbox, database_sandbox):
    register(api)
    known = api.post("/api/v1/auth/password/reset/request", json={"email": "person@example.com"})
    unknown = api.post("/api/v1/auth/password/reset/request", json={"email": "unknown@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    token = mailbox.last_token()
    assert token not in known.text
    with database_sandbox.engine.connect() as connection:
        digest = connection.scalar(text("SELECT token_hash FROM mail_tokens"))
    assert len(digest) == 32
    assert token.encode() not in bytes(digest)


def test_password_reset_is_one_use_and_revokes_existing_sessions(api, mailbox):
    register(api)
    old_tokens = login(api).json()
    assert api.post("/api/v1/auth/password/reset/request", json={"email": "person@example.com"}).status_code == 202
    token = mailbox.last_token()
    payload = {"token": token, "password": "a-different-long-test-passphrase"}
    assert api.post("/api/v1/auth/password/reset/confirm", json=payload).status_code == 204
    assert api.get("/api/v1/users/me", headers=bearer(old_tokens)).status_code == 401
    assert login(api).status_code == 401
    assert login(api, password=payload["password"]).status_code == 200
    assert api.post("/api/v1/auth/password/reset/confirm", json=payload).status_code == 400


def test_email_confirmation_is_one_use(api, mailbox):
    register(api)
    headers = bearer(login(api).json())
    assert api.post("/api/v1/auth/email/verification", headers=headers).status_code == 202
    token = mailbox.last_token()
    assert api.post("/api/v1/auth/email/verify", json={"token": token}).status_code == 204
    assert api.get("/api/v1/users/me", headers=headers).json()["email_verified_at"] is not None
    assert api.post("/api/v1/auth/email/verify", json={"token": token}).status_code == 400


def test_expired_confirmation_does_not_verify_email(api, mailbox, database_sandbox):
    register(api)
    headers = bearer(login(api).json())
    assert api.post("/api/v1/auth/email/verification", headers=headers).status_code == 202
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE mail_tokens SET expires_at=:past"), {"past": utcnow()-timedelta(seconds=1)})
    assert api.post("/api/v1/auth/email/verify", json={"token": mailbox.last_token()}).status_code == 400
    assert api.get("/api/v1/users/me", headers=headers).json()["email_verified_at"] is None


def test_disabled_mail_is_reported_before_looking_up_an_account(api, mailbox):
    mailbox.enabled = False
    register(api)
    for email in ("person@example.com", "missing@example.com"):
        response = api.post("/api/v1/auth/password/reset/request", json={"email": email})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "MAIL_NOT_CONFIGURED"


def test_weak_reset_password_is_rejected_without_consuming_token(api, mailbox):
    register(api)
    assert api.post("/api/v1/auth/password/reset/request", json={"email": "person@example.com"}).status_code == 202
    token = mailbox.last_token()
    assert api.post("/api/v1/auth/password/reset/confirm", json={"token": token, "password": "short"}).status_code == 422
    assert api.post("/api/v1/auth/password/reset/confirm", json={"token": token, "password": PASSWORD}).status_code == 204


def test_refresh_does_not_make_an_old_login_recent(api, database_sandbox):
    register(api)
    tokens = login(api).json()
    with database_sandbox.engine.begin() as connection:
        connection.execute(text("UPDATE refresh_sessions SET authenticated_at=:old"), {"old": utcnow()-timedelta(minutes=6)})
    refreshed = api.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200
    assert api.post("/api/v1/auth/logout-all", headers=bearer(refreshed.json())).status_code == 403


def test_operator_cli_creates_admin_without_public_admin_registration(api, database_sandbox, monkeypatch):
    assert importlib.util.find_spec("app.cli") is not None
    from app import cli

    monkeypatch.setattr(cli, "Settings", lambda: database_sandbox.settings)
    monkeypatch.setattr(cli, "getpass", lambda prompt: PASSWORD)
    assert cli.main(["create-admin", "--email", "operator@example.com"]) == 0
    response = login(api, email="operator@example.com")
    assert response.status_code == 200
    assert api.get("/api/v1/users/me", headers=bearer(response.json())).json()["role"] == "admin"


def test_production_mail_adapter_does_not_enable_cleartext_smtp(api):
    assert importlib.util.find_spec("app.auth.mailer") is not None
    from app.auth.mailer import SMTPMailer

    settings = api.app.state.settings.model_copy(update={
        "environment": "production", "smtp_host": "smtp.example.com",
        "smtp_from": "sender@example.com", "smtp_starttls": False, "smtp_ssl": False,
    })
    assert not SMTPMailer(settings).enabled
