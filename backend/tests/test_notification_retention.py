from datetime import timedelta

import pytest
from sqlalchemy import text

from app.auth.security import utcnow
from app.jobs import retain_data
from test_auth import api
from test_vendors import categories, operator, vendor
from test_locations import ready_vendor
from test_outbox import queued

pytestmark = pytest.mark.integration


def test_disabled_provider_cannot_retain_pending_payload_indefinitely(
    api, queued, database_sandbox
):
    now = utcnow()
    with api.app.state.session_factory() as session:
        retain_data(session, now + timedelta(minutes=6))
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT status FROM notification_outbox"))
            == "SUPPRESSED"
        )
    with api.app.state.session_factory() as session:
        retain_data(session, now + timedelta(days=8))
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT payload FROM notification_outbox")) == {}


def test_stale_device_address_is_purged_after_thirty_days(
    api, queued, database_sandbox
):
    with api.app.state.session_factory() as session:
        retain_data(session, utcnow() + timedelta(days=31))
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM device_tokens")) == 0
        assert connection.scalar(text("SELECT count(*) FROM notification_outbox")) == 0


def test_disabled_provider_cannot_retain_unfinished_receipts_indefinitely(
    api, queued, database_sandbox
):
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text("UPDATE notification_outbox SET status='AWAITING_RECEIPT'")
        )
    with api.app.state.session_factory() as session:
        retain_data(session, utcnow() + timedelta(hours=25))
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT status FROM notification_outbox"))
            == "FAILED"
        )
        assert (
            connection.scalar(text("SELECT last_error_code FROM notification_outbox"))
            == "RECEIPT_TIMEOUT"
        )
