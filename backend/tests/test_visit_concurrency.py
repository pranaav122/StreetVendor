from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from test_auth import api
from test_vendors import categories, customer_headers, operator, vendor
from test_locations import ready_vendor
from test_visits import action, create_request, pending

pytestmark = pytest.mark.integration


def test_concurrent_accept_cancel_has_one_winner(
    api, vendor, pending, database_sandbox
):
    visit, customer = pending
    gate = Barrier(2)

    def perform(headers, name):
        gate.wait(timeout=5)
        return action(api, visit, headers, name)

    with ThreadPoolExecutor(max_workers=2) as pool:
        accept = pool.submit(perform, vendor, "accept")
        cancel = pool.submit(perform, customer, "cancel")
        results = [accept.result(timeout=10), cancel.result(timeout=10)]
    assert sorted(x.status_code for x in results) == [200, 409]
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 2
        assert connection.scalar(text("SELECT version FROM visit_requests")) == 2


def test_concurrent_creation_retries_make_one_request_and_event(
    api, ready_vendor, database_sandbox
):
    headers, key = customer_headers(api), str(uuid4())
    gate = Barrier(2)

    def perform():
        gate.wait(timeout=5)
        return create_request(api, headers, ready_vendor[0]["id"], key=key)

    with ThreadPoolExecutor(max_workers=2) as pool:
        first, second = pool.submit(perform), pool.submit(perform)
        results = [first.result(timeout=10), second.result(timeout=10)]
    assert [x.status_code for x in results] == [201, 201]
    assert results[0].json()["id"] == results[1].json()["id"]
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM visit_requests")) == 1
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 1


def test_expiry_racing_acceptance_cannot_create_two_terminal_events(
    api, vendor, pending, database_sandbox
):
    from app.jobs import expire_visits
    from app.auth.security import utcnow

    visit, _ = pending
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE visit_requests SET created_at=now()-interval '10 minutes',expires_at=now()-interval '1 second'"
            )
        )
    gate = Barrier(2)

    def expiry():
        gate.wait(timeout=5)
        with api.app.state.session_factory() as session:
            return expire_visits(session, utcnow())

    def acceptance():
        gate.wait(timeout=5)
        return action(api, visit, vendor, "accept")

    with ThreadPoolExecutor(max_workers=2) as pool:
        expired, accepted = pool.submit(expiry), pool.submit(acceptance)
        assert expired.result(timeout=10) in (0, 1)
        assert accepted.result(timeout=10).status_code == 409
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT status FROM visit_requests")) == "EXPIRED"
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 2


def test_event_insert_failure_rolls_back_state_version_and_event(
    api, vendor, pending, database_sandbox
):
    visit, _ = pending
    with database_sandbox.engine.begin() as connection:
        connection.execute(
            text(
                "CREATE FUNCTION reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic event failure'; END $$"
            )
        )
        connection.execute(
            text(
                "CREATE TRIGGER reject_test_event BEFORE INSERT ON request_events FOR EACH ROW EXECUTE FUNCTION reject_test_event()"
            )
        )
    with pytest.raises(SQLAlchemyError):
        action(api, visit, vendor, "accept")
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT status FROM visit_requests")) == "PENDING"
        assert connection.scalar(text("SELECT version FROM visit_requests")) == 1
        assert connection.scalar(text("SELECT count(*) FROM request_events")) == 1
