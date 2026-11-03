from datetime import timedelta

import pytest
from sqlalchemy import text

from app.auth.security import utcnow
from test_auth import api
from test_vendors import categories, operator, vendor
from test_locations import ready_vendor
from test_outbox import provider, queued, dispatch

pytestmark = pytest.mark.integration


def ticket_id(database_sandbox):
    with database_sandbox.engine.connect() as connection:
        return connection.scalar(
            text("SELECT provider_ticket_id FROM notification_outbox")
        )


def test_receipt_success_records_provider_acceptance(
    api, queued, provider, database_sandbox
):
    now = utcnow()
    assert dispatch(api, provider, now).accepted == 1
    identifier = ticket_id(database_sandbox)
    provider.receipt_data = {identifier: {"status": "ok"}}
    result = dispatch(api, provider, now + timedelta(minutes=16))
    assert result.receipt_ok == 1
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT status FROM notification_outbox"))
            == "RECEIPT_OK"
        )


@pytest.mark.parametrize("stage", ["ticket", "receipt"])
def test_unregistered_token_is_retired_on_permanent_provider_error(
    api, queued, provider, database_sandbox, stage
):
    now = utcnow()
    if stage == "ticket":
        provider.ticket_error = "DeviceNotRegistered"
        dispatch(api, provider, now)
    else:
        assert dispatch(api, provider, now).accepted == 1
        provider.receipt_data = {
            ticket_id(database_sandbox): {
                "status": "error",
                "details": {"error": "DeviceNotRegistered"},
            }
        }
        dispatch(api, provider, now + timedelta(minutes=16))
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(
            text("SELECT disabled_at IS NOT NULL FROM device_tokens")
        )
        assert (
            connection.scalar(text("SELECT status FROM notification_outbox"))
            == "FAILED"
        )


def test_missing_receipt_retries_without_resending_notification(
    api, queued, provider, database_sandbox
):
    now = utcnow()
    assert dispatch(api, provider, now).accepted == 1
    assert dispatch(api, provider, now + timedelta(minutes=16)).receipt_ok == 0
    assert len(provider.messages) == 1
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT status FROM notification_outbox"))
            == "AWAITING_RECEIPT"
        )
