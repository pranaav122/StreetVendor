import importlib.util
from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text, select
from sqlalchemy.exc import SQLAlchemyError

from app.auth.security import utcnow
from test_auth import api, bearer, login, register
from test_vendors import categories, operator, vendor, customer_headers
from test_locations import ready_vendor
from test_visits import action, create_request
from test_devices import register_device

pytestmark = pytest.mark.integration


class RecordingProvider:
    """Replace the external provider only; business transactions remain real."""

    enabled = True

    def __init__(self):
        self.messages = []
        self.batches = []
        self.receipt_calls = []
        self.receipt_data = {}
        self.failure = None
        self.ticket_error = None

    def send(self, messages):
        self.batches.append(list(messages))
        self.messages.extend(messages)
        if self.failure:
            raise self.failure
        if self.ticket_error:
            return [
                {"status": "error", "details": {"error": self.ticket_error}}
                for _ in messages
            ]
        return [{"status": "ok", "id": str(uuid4())} for _ in messages]

    def receipts(self, ids):
        self.receipt_calls.append(ids)
        return self.receipt_data


@pytest.fixture
def provider():
    return RecordingProvider()


@pytest.fixture
def queued(api, vendor, ready_vendor):
    device, installation, token = register_device(api, vendor, kind="vendor")
    assert device.status_code == 200, device.text
    customer = customer_headers(api)
    response = create_request(api, customer, ready_vendor[0]["id"])
    assert response.status_code == 201, response.text
    return response.json(), customer, installation, token


def dispatch(api, provider, now=None):
    assert importlib.util.find_spec("app.notifications.dispatcher") is not None
    from app.notifications.dispatcher import dispatch_batch

    return dispatch_batch(api.app.state.session_factory, provider, now or utcnow())


def test_outbox_is_per_event_device_and_has_no_coordinates(
    api, vendor, ready_vendor, database_sandbox
):
    assert register_device(api, vendor, kind="vendor")[0].status_code == 200
    assert register_device(api, vendor, kind="vendor")[0].status_code == 200
    customer = customer_headers(api)
    assert create_request(api, customer, ready_vendor[0]["id"]).status_code == 201
    from app.models.visits import RequestEvent
    from app.notifications.service import enqueue_for_event

    with api.app.state.session_factory() as session:
        event = session.scalar(select(RequestEvent))
        enqueue_for_event(session, event)
        session.commit()
    with database_sandbox.engine.connect() as connection:
        rows = (
            connection.execute(text("SELECT payload FROM notification_outbox"))
            .scalars()
            .all()
        )
        assert len(rows) == 2
        assert all(
            set(row) == {"notification_id", "request_id", "event_type"} for row in rows
        )


def test_outbox_failure_rolls_back_business_state_and_event(
    api, vendor, ready_vendor, database_sandbox
):
    customer = customer_headers(api)
    visit = create_request(api, customer, ready_vendor[0]["id"]).json()
    assert register_device(api, customer)[0].status_code == 200
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "CREATE FUNCTION fail_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic outbox failure'; END $$"
            )
        )
        connection.execute(
            text(
                "CREATE TRIGGER fail_test_outbox BEFORE INSERT ON notification_outbox FOR EACH ROW EXECUTE FUNCTION fail_test_outbox()"
            )
        )
    with pytest.raises(SQLAlchemyError):
        action(api, visit, vendor, "accept")
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT status FROM visit_requests")) == "PENDING"
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 1
        assert connection.scalar(text("SELECT count(*) FROM notification_outbox")) == 0


def test_provider_acceptance_is_ticketed_and_external_payload_is_minimal(
    api, queued, provider, database_sandbox
):
    result = dispatch(api, provider)
    assert result.accepted == 1
    assert provider.messages[0]["to"] == queued[3]
    assert set(provider.messages[0]["data"]) == {
        "notification_id",
        "request_id",
        "event_type",
    }
    assert "latitude" not in str(provider.messages) and "Public market" not in str(
        provider.messages
    )
    with database_sandbox.engine.connect() as connection:
        row = connection.execute(
            text("SELECT status,provider_ticket_id FROM notification_outbox")
        ).one()
        assert row.status == "AWAITING_RECEIPT" and row.provider_ticket_id


def test_network_timeout_retries_with_backoff_without_losing_job(
    api, queued, provider, database_sandbox
):
    now = utcnow()
    provider.failure = TimeoutError("Synthetic transport failure")
    assert dispatch(api, provider, now).retried == 1
    with database_sandbox.engine.connect() as connection:
        row = connection.execute(
            text("SELECT status,attempts,next_attempt_at FROM notification_outbox")
        ).one()
        assert (
            row.status == "PENDING" and row.attempts == 1 and row.next_attempt_at > now
        )
    provider.failure = None
    assert dispatch(api, provider, now + timedelta(minutes=1)).accepted == 1


def test_expired_lease_is_recovered_and_cancellation_gets_its_own_job(
    api, vendor, queued, provider, database_sandbox
):
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE notification_outbox SET status='SENDING',lease_until=now()-interval '1 second',lease_token=:token,attempts=1"
            ),
            {"token": uuid4()},
        )
    assert dispatch(api, provider).accepted == 1
    assert action(api, queued[0], queued[1], "cancel").status_code == 200
    provider.messages.clear()
    # Already accepted messages cannot be recalled; cancellation gets a separate current job.
    result = dispatch(api, provider)
    assert result.accepted == 1
    assert all(
        message["data"]["event_type"] == "REQUEST_CANCELLED"
        for message in provider.messages
    )


def test_obsolete_and_disabled_configuration_never_claim_success(
    api, vendor, queued, provider, database_sandbox
):
    provider.enabled = False
    result = dispatch(api, provider)
    assert not result.enabled and result.accepted == 0 and provider.messages == []
    provider.enabled = True
    assert action(api, queued[0], vendor, "accept").status_code == 200
    result = dispatch(api, provider)
    assert result.suppressed == 1 and result.accepted == 0 and provider.messages == []


def test_late_provider_error_cannot_disable_a_new_device_owner(
    api, queued, provider, database_sandbox
):
    new_owner = {}

    def switching_send(messages):
        user = register(api, "vendor", "replacement-vendor@example.com").json()
        headers = bearer(login(api, "replacement-vendor@example.com").json())
        response, _, _ = register_device(
            api, headers, kind="vendor", installation=queued[2], token=queued[3]
        )
        assert response.status_code == 200
        new_owner["id"] = user["id"]
        return [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]

    provider.send = switching_send
    dispatch(api, provider)
    with database_sandbox.engine.connect() as connection:
        row = connection.execute(
            text("SELECT user_id,disabled_at FROM device_tokens")
        ).one()
        assert str(row.user_id) == new_owner["id"] and row.disabled_at is None
        assert connection.scalar(text("SELECT count(*) FROM notification_outbox")) == 0


def test_stale_lease_response_cannot_overwrite_a_recovered_ticket(
    api, queued, provider, database_sandbox
):
    def delayed_send(messages):
        with database_sandbox.engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE notification_outbox SET lease_token=:token,status='AWAITING_RECEIPT',provider_ticket_id='newer-ticket',next_attempt_at=now()+interval '15 minutes'"
                ),
                {"token": uuid4()},
            )
        return [{"status": "ok", "id": "stale-ticket"}]

    provider.send = delayed_send
    assert dispatch(api, provider).accepted == 0
    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT provider_ticket_id FROM notification_outbox")
            )
            == "newer-ticket"
        )


def test_customer_and_vendor_projects_are_sent_in_separate_batches(
    api, vendor, queued, provider, database_sandbox
):
    visit, customer, _, _ = queued
    assert register_device(api, customer)[0].status_code == 200
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE visit_requests SET created_at=now()-interval '10 minutes',expires_at=now()-interval '1 second'"
            )
        )
    assert (
        api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()["status"]
        == "EXPIRED"
    )
    result = dispatch(api, provider)
    assert result.accepted == 2 and result.suppressed == 1
    assert len(provider.batches) == 2 and all(
        len(batch) == 1 for batch in provider.batches
    )


def test_one_invalid_batch_does_not_fail_its_valid_recipient(
    api, vendor, ready_vendor, provider, database_sandbox
):
    from app.notifications.provider import ProviderError

    first, _, bad_token = register_device(api, vendor, kind="vendor")
    assert first.status_code == 200
    assert register_device(api, vendor, kind="vendor")[0].status_code == 200
    customer = customer_headers(api)
    assert create_request(api, customer, ready_vendor[0]["id"]).status_code == 201

    def isolated_send(messages):
        if len(messages) > 1:
            raise ProviderError("HTTP_400", False)
        if messages[0]["to"] == bad_token:
            return [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]
        return [{"status": "ok", "id": "valid-recipient-ticket"}]

    provider.send = isolated_send
    result = dispatch(api, provider)
    assert result.accepted == 1 and result.failed == 1
