import importlib.util
from datetime import timedelta
import time
from uuid import uuid4

import pytest
import jwt
from starlette.websockets import WebSocketDisconnect

from test_auth import api, bearer, login, register
from test_vendors import operator
from app.auth.security import utcnow

pytestmark = pytest.mark.integration


def authenticate(socket, tokens):
    socket.send_json({"type": "AUTHENTICATE", "access_token": tokens["access_token"]})
    response = socket.receive_json()
    assert response["type"] == "AUTHENTICATED" and response["resync_required"]
    return response


def test_socket_requires_bounded_initial_authentication(api):
    with pytest.raises(WebSocketDisconnect) as error:
        with api.websocket_connect("/api/v1/ws") as socket:
            socket.send_json({"type": "PING", "id": str(uuid4())})
            socket.receive_json()
    assert error.value.code == 4401


def test_auth_deadline_and_oversized_first_frame_close_without_private_data(api):
    object.__setattr__(api.app.state.settings, "ws_auth_timeout_seconds", 0.05)
    with pytest.raises(WebSocketDisconnect) as error:
        with api.websocket_connect("/api/v1/ws") as socket:
            socket.receive_json()
    assert error.value.code == 4401
    with pytest.raises(WebSocketDisconnect) as error:
        with api.websocket_connect("/api/v1/ws") as socket:
            socket.send_text("x" * 9000)
            socket.receive_json()
    assert error.value.code == 1009


@pytest.mark.parametrize(
    "suffix,headers",
    [
        ("?access_token=forbidden-url-value", {}),
        ("", {"Origin": "https://untrusted.example"}),
    ],
)
def test_query_tokens_and_untrusted_browser_origins_are_rejected(api, suffix, headers):
    with pytest.raises(WebSocketDisconnect) as error:
        with api.websocket_connect("/api/v1/ws" + suffix, headers=headers):
            pass
    assert error.value.code == 1008


def test_authenticated_heartbeat_and_invalid_message_size(api):
    register(api)
    tokens = login(api).json()
    with api.websocket_connect("/api/v1/ws") as socket:
        authenticate(socket, tokens)
        ping = str(uuid4())
        socket.send_json({"type": "PING", "id": ping})
        assert socket.receive_json() == {"type": "PONG", "id": ping}
        with pytest.raises(WebSocketDisconnect) as error:
            socket.send_text("x" * 9000)
            socket.receive_json()
        assert error.value.code == 1009


def test_logout_revokes_existing_socket_before_next_response(api):
    register(api)
    tokens = login(api).json()
    with api.websocket_connect("/api/v1/ws") as socket:
        authenticate(socket, tokens)
        assert (
            api.post("/api/v1/auth/logout", headers=bearer(tokens)).status_code == 204
        )
        with pytest.raises(WebSocketDisconnect) as error:
            socket.send_json({"type": "PING", "id": str(uuid4())})
            socket.receive_json()
        assert error.value.code == 4401


def test_reauthentication_cannot_switch_accounts_on_a_live_connection(api):
    register(api)
    original = login(api).json()
    register(api, email="socket-second@example.com")
    other = login(api, "socket-second@example.com").json()
    with api.websocket_connect("/api/v1/ws") as socket:
        authenticate(socket, original)
        with pytest.raises(WebSocketDisconnect) as error:
            socket.send_json(
                {"type": "AUTHENTICATE", "access_token": other["access_token"]}
            )
            socket.receive_json()
        assert error.value.code == 4401


def test_per_account_connection_limit_rejects_an_extra_socket(api):
    register(api)
    tokens = login(api).json()
    object.__setattr__(api.app.state.settings, "ws_max_per_user", 1)
    with api.websocket_connect("/api/v1/ws") as first:
        authenticate(first, tokens)
        with pytest.raises(WebSocketDisconnect) as error:
            with api.websocket_connect("/api/v1/ws") as second:
                authenticate(second, tokens)
        assert error.value.code == 4429


def test_slow_consumer_mailbox_discards_private_hints_and_requests_close():
    assert importlib.util.find_spec("app.realtime") is not None
    from app.realtime.manager import BoundedMailbox

    mailbox = BoundedMailbox(2)
    assert mailbox.offer({"kind": "EVENT", "id": str(uuid4())})
    assert mailbox.offer({"kind": "EVENT", "id": str(uuid4())})
    assert not mailbox.offer({"kind": "EVENT", "id": str(uuid4())})
    assert mailbox.queue.qsize() == 1
    assert mailbox.queue.get_nowait() == {"kind": "CLOSE", "code": 4429}


def test_expired_initial_token_and_refreshed_socket_expiry_are_enforced(api):
    register(api)
    tokens = login(api).json()
    claims = jwt.decode(tokens["access_token"], options={"verify_signature": False})
    key = api.app.state.settings.jwt_secret.get_secret_value()
    expired = tokens | {
        "access_token": jwt.encode(
            claims | {"exp": utcnow() - timedelta(seconds=1)}, key, algorithm="HS256"
        )
    }
    with pytest.raises(WebSocketDisconnect) as error:
        with api.websocket_connect("/api/v1/ws") as socket:
            authenticate(socket, expired)
    assert error.value.code == 4401
    with api.websocket_connect("/api/v1/ws") as socket:
        authenticate(socket, tokens)
        short = tokens | {
            "access_token": jwt.encode(
                claims | {"exp": utcnow() + timedelta(seconds=2)},
                key,
                algorithm="HS256",
            )
        }
        authenticate(socket, short)
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 4401


def test_suspension_closes_a_live_socket_and_idle_clients_expire(api, operator):
    user = register(api).json()
    tokens = login(api).json()
    with api.websocket_connect("/api/v1/ws") as socket:
        authenticate(socket, tokens)
        assert (
            api.post(
                f"/api/v1/admin/users/{user['id']}/suspension",
                headers=operator,
                json={
                    "suspended": True,
                    "reason": "Synthetic account suspension for socket verification",
                },
            ).status_code
            == 200
        )
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 4401
    register(api, email="idle-socket@example.com")
    idle = login(api, "idle-socket@example.com").json()
    object.__setattr__(api.app.state.settings, "ws_idle_timeout_seconds", 0.1)
    with api.websocket_connect("/api/v1/ws") as socket:
        authenticate(socket, idle)
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 4408
