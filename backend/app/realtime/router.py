"""Authenticate before data; every outgoing hint uses a fresh database check."""

import asyncio
import json
from contextlib import suppress
from uuid import uuid4

import anyio

from fastapi import APIRouter, HTTPException, WebSocket
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from starlette.websockets import WebSocketDisconnect, WebSocketState

from app.realtime.schemas import AuthenticateInput, PingInput, SubscriptionInput

router = APIRouter()


class SocketStop(Exception):
    def __init__(self, code):
        self.code = code


async def read_message(socket):
    frame = await socket.receive()
    if frame["type"] == "websocket.disconnect":
        raise WebSocketDisconnect(frame.get("code", 1000))
    raw = frame.get("text")
    if raw is None:
        raise SocketStop(1003)
    try:
        if len(raw.encode("utf-8")) > 8192:
            raise SocketStop(1009)
        value = json.loads(raw)
    except (ValueError, UnicodeError):
        raise SocketStop(4400) from None
    if not isinstance(value, dict):
        raise SocketStop(4400)
    return value


async def current(manager, connection):
    context = await asyncio.to_thread(manager.authenticate, connection.token)
    if (
        context.user.id != connection.user_id
        or context.family_id != connection.family_id
    ):
        raise SocketStop(4401)
    return context


async def receive_loop(socket, manager, connection):
    while True:
        message = await read_message(socket)
        kind = message.get("type")
        if kind == "AUTHENTICATE":
            payload = AuthenticateInput.model_validate(message)
            raw = payload.access_token.get_secret_value()
            context = await asyncio.to_thread(manager.authenticate, raw)
            if (
                context.user.id != connection.user_id
                or context.family_id != connection.family_id
            ):
                raise SocketStop(4401)
            connection.token = raw
            connection.last_ping = asyncio.get_running_loop().time()
            connection.mailbox.offer(
                {
                    "kind": "PUBLIC",
                    "message": {
                        "type": "AUTHENTICATED",
                        "connection_id": connection.id,
                        "expires_at": context.expires_at,
                        "resync_required": True,
                    },
                }
            )
            continue
        await current(manager, connection)
        if kind == "PING":
            payload = PingInput.model_validate(message)
            connection.last_ping = asyncio.get_running_loop().time()
            connection.mailbox.offer(
                {"kind": "PUBLIC", "message": {"type": "PONG", "id": str(payload.id)}}
            )
        elif kind in ("SUBSCRIBE_REQUEST", "UNSUBSCRIBE_REQUEST"):
            payload = SubscriptionInput.model_validate(message)
            if kind == "UNSUBSCRIBE_REQUEST":
                connection.subscriptions.pop(payload.request_id, None)
                connection.mailbox.offer(
                    {
                        "kind": "PUBLIC",
                        "message": {
                            "type": "UNSUBSCRIBED_REQUEST",
                            "request_id": payload.request_id,
                        },
                    }
                )
                continue
            if (
                len(connection.subscriptions) >= 10
                and payload.request_id not in connection.subscriptions
            ):
                connection.mailbox.offer(
                    {
                        "kind": "PUBLIC",
                        "message": {"type": "ERROR", "code": "SUBSCRIPTION_LIMIT"},
                    }
                )
                continue
            try:
                vendor_id, version = await asyncio.to_thread(
                    manager.subscribe, connection.token, payload.request_id
                )
            except HTTPException as error:
                if error.status_code not in (403, 404, 409):
                    raise
                code = (
                    "TRACKING_UNAVAILABLE" if error.status_code == 409 else "FORBIDDEN"
                )
                connection.mailbox.offer(
                    {"kind": "PUBLIC", "message": {"type": "ERROR", "code": code}}
                )
                continue
            connection.subscriptions[payload.request_id] = vendor_id
            connection.mailbox.offer(
                {
                    "kind": "PUBLIC",
                    "message": {
                        "type": "SUBSCRIBED_REQUEST",
                        "request_id": payload.request_id,
                        "request_version": version,
                    },
                }
            )
            # Only an ID enters the queue. Private coordinates are fetched at send time.
            connection.mailbox.offer(
                {"kind": "LOCATION", "request_id": payload.request_id}
            )
        else:
            raise SocketStop(4400)


async def send_loop(socket, manager, connection):
    while True:
        command = await connection.mailbox.queue.get()
        if command["kind"] == "CLOSE":
            raise SocketStop(command["code"])
        if (
            command["kind"] == "LOCATION"
            and command["request_id"] not in connection.subscriptions
        ):
            continue
        await current(manager, connection)
        terminal_id = None
        if command["kind"] == "PUBLIC":
            message = command["message"]
        else:
            try:
                message, terminal_id = await asyncio.to_thread(
                    manager.resolve, connection.token, command
                )
            except HTTPException as error:
                if error.status_code in (404, 409):
                    connection.subscriptions.pop(command.get("request_id"), None)
                    continue
                raise
            if message is None:
                continue
            if command["kind"] == "STATE":
                key = command["id"]
                available = (
                    message["is_available"] and message["location_sharing_enabled"]
                )
                if connection.vendor_states.get(key) == available:
                    continue
                connection.vendor_states[key] = available
                message = {
                    "event_id": uuid4(),
                    "type": "VENDOR_ONLINE" if available else "VENDOR_OFFLINE",
                    "data": message,
                }
        if terminal_id:
            connection.subscriptions.pop(terminal_id, None)
        # Unsubscribe may happen while the short database read is in flight.
        if (
            command["kind"] == "LOCATION"
            and command["request_id"] not in connection.subscriptions
        ):
            continue
        # Bound network backpressure independently of the bounded application mailbox.
        await asyncio.wait_for(socket.send_json(jsonable_encoder(message)), timeout=1)


async def watch_session(manager, connection):
    while True:
        await asyncio.sleep(0.5)
        if (
            asyncio.get_running_loop().time() - connection.last_ping
            > manager.app.state.settings.ws_idle_timeout_seconds
        ):
            raise SocketStop(4408)
        await current(manager, connection)


async def run_connection(socket, manager, connection):
    tasks = [
        asyncio.create_task(receive_loop(socket, manager, connection)),
        asyncio.create_task(send_loop(socket, manager, connection)),
        asyncio.create_task(watch_session(manager, connection)),
    ]
    try:
        finished, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in finished:
            task.result()
    finally:
        for task in tasks:
            task.cancel()
        # ASGI servers may cancel the surrounding scope during disconnect.
        # Let child cleanup finish instead of propagating repeated cancellation.
        with anyio.CancelScope(shield=True):
            await asyncio.gather(*tasks, return_exceptions=True)


@router.websocket("/api/v1/ws")
async def websocket_endpoint(socket: WebSocket):
    manager = socket.app.state.realtime
    origin = socket.headers.get("origin")
    if socket.scope.get("query_string") or (
        origin is not None and origin not in socket.app.state.settings.allowed_origins
    ):
        await socket.close(code=1008)
        return
    ip = socket.client.host if socket.client else "unknown"
    if not manager.reserve(ip):
        await socket.close(code=4429)
        return
    connection = None
    close_code = 1000
    try:
        await socket.accept()
        try:
            async with asyncio.timeout(
                socket.app.state.settings.ws_auth_timeout_seconds
            ):
                payload = AuthenticateInput.model_validate(await read_message(socket))
                token = payload.access_token.get_secret_value()
                context = await asyncio.to_thread(manager.authenticate, token)
        except (TimeoutError, ValidationError):
            raise SocketStop(4401) from None
        if not await manager.ensure_listener():
            raise SocketStop(1013)
        connection = manager.register(context, token)
        if connection is None:
            raise SocketStop(4429)
        await asyncio.wait_for(
            socket.send_json(
                jsonable_encoder(
                    {
                        "type": "AUTHENTICATED",
                        "connection_id": connection.id,
                        "expires_at": context.expires_at,
                        "resync_required": True,
                    }
                )
            ),
            timeout=1,
        )
        await run_connection(socket, manager, connection)
    except SocketStop as error:
        close_code = error.code
    except HTTPException as error:
        if error.status_code == 401:
            close_code = 4401
        elif error.status_code == 403:
            close_code = 4403
        else:
            close_code = 1013
    except ValidationError:
        close_code = 4400
    except SQLAlchemyError:
        close_code = 1013
    except TimeoutError:
        close_code = 4429
    except WebSocketDisconnect as error:
        close_code = error.code
    finally:
        if connection:
            manager.unregister(connection)
        manager.release(ip)
        if (
            socket.client_state != WebSocketState.DISCONNECTED
            and socket.application_state == WebSocketState.CONNECTED
        ):
            with anyio.move_on_after(1, shield=True):
                with suppress(WebSocketDisconnect, RuntimeError, OSError):
                    await socket.close(code=close_code)
