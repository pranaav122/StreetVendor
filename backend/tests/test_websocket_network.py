"""Real TCP framing and two independent clients complement ASGI protocol tests."""

import json
import socket
import threading
import time
from uuid import uuid4

import pytest
import uvicorn
from websockets.sync.client import connect

from app.main import create_app
from test_auth import api, login, register
from test_vendors import categories, operator, vendor
from test_locations import ready_vendor
from test_visits import pending, action

pytestmark = pytest.mark.integration


def receive_type(connection, event_type):
    for _ in range(20):
        message = json.loads(connection.recv(timeout=3))
        if message["type"] == event_type:
            return message
    raise AssertionError("Missing expected native WebSocket frame")


def test_native_two_client_isolation_and_committed_event_delivery(api, vendor, pending):
    visit, _ = pending
    owner = login(api, "customer@example.com").json()
    register(api, email="native-outsider@example.com")
    outsider = login(api, "native-outsider@example.com").json()
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    server = uvicorn.Server(
        uvicorn.Config(
            create_app(api.app.state.settings),
            host="127.0.0.1",
            port=port,
            ws_max_size=8192,
            ws_max_queue=8,
            log_level="error",
            access_log=False,
            timeout_graceful_shutdown=3,
        )
    )
    thread = threading.Thread(
        target=server.run, kwargs={"sockets": [listener]}, daemon=True
    )
    thread.start()
    try:
        deadline = time.monotonic() + 8
        while not server.started and time.monotonic() < deadline and thread.is_alive():
            time.sleep(0.03)
        assert server.started
        url = f"ws://127.0.0.1:{port}/api/v1/ws"
        # Ignore ambient HTTP proxies for the explicitly loopback-only test server.
        with (
            connect(url, proxy=None, open_timeout=3, close_timeout=2) as own,
            connect(url, proxy=None, open_timeout=3, close_timeout=2) as other,
        ):
            for connection, tokens in ((own, owner), (other, outsider)):
                connection.send(
                    json.dumps(
                        {"type": "AUTHENTICATE", "access_token": tokens["access_token"]}
                    )
                )
                assert receive_type(connection, "AUTHENTICATED")["resync_required"]
            other.send(
                json.dumps({"type": "SUBSCRIBE_REQUEST", "request_id": visit["id"]})
            )
            assert receive_type(other, "ERROR")["code"] == "FORBIDDEN"
            assert action(api, visit, vendor, "accept").status_code == 200
            assert receive_type(own, "REQUEST_ACCEPTED")["request_version"] == 2
            with pytest.raises(TimeoutError):
                other.recv(timeout=0.25)
            ping = str(uuid4())
            other.send(json.dumps({"type": "PING", "id": ping}))
            assert receive_type(other, "PONG")["id"] == ping
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        listener.close()
        assert not thread.is_alive()
