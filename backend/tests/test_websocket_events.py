from uuid import uuid4
import asyncio

import pytest

from test_auth import api, login, register, bearer
from test_vendors import categories, fix, operator, vendor
from test_locations import ready_vendor
from test_visits import action, pending
from test_websocket_auth import authenticate

pytestmark = pytest.mark.integration


def receive_type(socket, event_type):
    # The server bounds send/heartbeat time; unrelated authorized hints may precede this one.
    for _ in range(30):
        message = socket.receive_json()
        if message["type"] == event_type:
            return message
    raise AssertionError("Expected event was not among the bounded incoming messages")


def test_inbox_event_is_committed_versioned_and_isolated_from_other_customer(
    api, vendor, pending
):
    visit, customer = pending
    tokens = login(api, "customer@example.com").json()
    register(api, email="socket-outsider@example.com")
    outsider = login(api, "socket-outsider@example.com").json()
    with (
        api.websocket_connect("/api/v1/ws") as own,
        api.websocket_connect("/api/v1/ws") as other,
    ):
        authenticate(own, tokens)
        authenticate(other, outsider)
        other.send_json({"type": "SUBSCRIBE_REQUEST", "request_id": visit["id"]})
        assert receive_type(other, "ERROR")["code"] == "FORBIDDEN"
        accepted = action(api, visit, vendor, "accept")
        assert accepted.status_code == 200
        event = receive_type(own, "REQUEST_ACCEPTED")
        assert event["request_id"] == visit["id"] and event["request_version"] == 2
        assert event["data"] == {"status": "ACCEPTED"}
        assert (
            api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()[
                "version"
            ]
            == event["request_version"]
        )
        ping = str(uuid4())
        other.send_json({"type": "PING", "id": ping})
        assert other.receive_json() == {"type": "PONG", "id": ping}


def test_precise_subscription_ends_at_terminal_state_and_cannot_be_reopened(
    api, vendor, pending
):
    visit, customer = pending
    accepted = action(api, visit, vendor, "accept").json()
    tokens = login(api, "customer@example.com").json()
    with api.websocket_connect("/api/v1/ws") as socket:
        authenticate(socket, tokens)
        socket.send_json({"type": "SUBSCRIBE_REQUEST", "request_id": visit["id"]})
        assert receive_type(socket, "SUBSCRIBED_REQUEST")["request_id"] == visit["id"]
        location = receive_type(socket, "VENDOR_LOCATION_UPDATED")
        assert location["data"]["longitude"] == 80.2707
        assert location["request_version"] == accepted["version"]
        cancelled = action(api, accepted, customer, "cancel")
        assert cancelled.status_code == 200
        assert receive_type(socket, "REQUEST_CANCELLED")["request_version"] == 3
        assert (
            api.put(
                "/api/v1/vendors/me/location",
                headers=vendor,
                json=fix(longitude=80.271),
            ).status_code
            == 200
        )
        socket.send_json({"type": "SUBSCRIBE_REQUEST", "request_id": visit["id"]})
        assert receive_type(socket, "ERROR")["code"] == "TRACKING_UNAVAILABLE"
        ping = str(uuid4())
        socket.send_json({"type": "PING", "id": ping})
        assert receive_type(socket, "PONG")["id"] == ping
    assert not api.app.state.realtime.connections
    assert not api.app.state.realtime.ip_counts


def test_reconnect_requires_rest_resync_and_never_replays_old_precise_location(
    api, vendor, pending
):
    visit, customer = pending
    accepted = action(api, visit, vendor, "accept").json()
    tokens = login(api, "customer@example.com").json()
    with api.websocket_connect("/api/v1/ws") as first:
        authenticate(first, tokens)
    assert action(api, accepted, customer, "cancel").status_code == 200
    with api.websocket_connect("/api/v1/ws") as second:
        assert authenticate(second, tokens)["resync_required"]
        current = api.get(f"/api/v1/requests/{visit['id']}", headers=customer).json()
        assert current["status"] == "CANCELLED"
        second.send_json({"type": "SUBSCRIBE_REQUEST", "request_id": visit["id"]})
        assert receive_type(second, "ERROR")["code"] == "TRACKING_UNAVAILABLE"


def test_queued_location_hint_cannot_outlive_unsubscription(api, vendor, pending):
    from app.realtime.router import SocketStop, send_loop

    visit, _ = pending
    assert action(api, visit, vendor, "accept").status_code == 200
    tokens = login(api, "customer@example.com").json()
    manager = api.app.state.realtime
    context = manager.authenticate(tokens["access_token"])
    messages = []

    class RecordingSocket:
        async def send_json(self, message):
            messages.append(message)
            if message["type"] == "PONG":
                raise SocketStop(1000)

    async def scenario():
        connection = manager.register(context, tokens["access_token"])
        try:
            # A hint was queued before unsubscribe; the subscription is already removed.
            connection.mailbox.offer({"kind": "LOCATION", "request_id": visit["id"]})
            connection.mailbox.offer(
                {"kind": "PUBLIC", "message": {"type": "PONG", "id": "test-barrier"}}
            )
            with pytest.raises(SocketStop):
                await send_loop(RecordingSocket(), manager, connection)
        finally:
            manager.unregister(connection)

    asyncio.run(scenario())
    assert [message["type"] for message in messages] == ["PONG"]
