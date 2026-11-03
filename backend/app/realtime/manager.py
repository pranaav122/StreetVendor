"""One process owns bounded socket queues and one lazy PostgreSQL listener."""

import asyncio
import logging
import threading
from collections import Counter
from dataclasses import dataclass, field
from uuid import UUID, uuid4

import psycopg
from sqlalchemy.exc import SQLAlchemyError

from app.realtime import read
from app.realtime.signals import CHANNEL

logger = logging.getLogger(__name__)


class BoundedMailbox:
    def __init__(self, capacity=32):
        if not 1 <= capacity <= 128:
            raise ValueError("Mailbox capacity must be bounded.")
        self.queue = asyncio.Queue(maxsize=capacity)
        self.overflowed = False

    def offer(self, item):
        if self.overflowed:
            return False
        try:
            self.queue.put_nowait(item)
            return True
        except asyncio.QueueFull:
            # Discard queued hints rather than letting a slow consumer retain private state.
            self.overflowed = True
            while not self.queue.empty():
                self.queue.get_nowait()
            self.queue.put_nowait({"kind": "CLOSE", "code": 4429})
            return False


@dataclass
class Connection:
    user_id: UUID
    family_id: UUID
    token: str
    last_ping: float
    id: UUID = field(default_factory=uuid4)
    mailbox: BoundedMailbox = field(default_factory=BoundedMailbox)
    subscriptions: dict = field(default_factory=dict)
    vendor_states: dict = field(default_factory=dict)


class RealtimeManager:
    def __init__(self, app):
        self.app = app
        self.connections = {}
        self.ip_counts = Counter()
        self.notices = asyncio.Queue(maxsize=512)
        self.stop = threading.Event()
        self.ready = threading.Event()
        self.thread = None
        self.consumer = None
        self.start_lock = asyncio.Lock()
        self.closed = False

    def reserve(self, ip):
        settings = self.app.state.settings
        if (
            sum(self.ip_counts.values()) >= settings.ws_max_connections
            or self.ip_counts[ip] >= settings.ws_max_per_ip
        ):
            return False
        self.ip_counts[ip] += 1
        return True

    def release(self, ip):
        self.ip_counts[ip] -= 1
        if self.ip_counts[ip] <= 0:
            self.ip_counts.pop(ip, None)

    def register(self, context, token):
        if (
            sum(
                connection.user_id == context.user.id
                for connection in self.connections.values()
            )
            >= self.app.state.settings.ws_max_per_user
        ):
            return None
        connection = Connection(
            context.user.id, context.family_id, token, asyncio.get_running_loop().time()
        )
        self.connections[connection.id] = connection
        return connection

    def unregister(self, connection):
        self.connections.pop(connection.id, None)
        connection.subscriptions.clear()
        connection.token = ""

    def authenticate(self, token):
        with self.app.state.session_factory() as session:
            return read.authenticate(session, token, self.app.state.settings)

    def subscribe(self, token, request_id):
        with self.app.state.session_factory() as session:
            context = read.authenticate(session, token, self.app.state.settings)
            return read.subscribe(session, context.user, request_id)

    def resolve(self, token, command):
        with self.app.state.session_factory() as session:
            context = read.authenticate(session, token, self.app.state.settings)
            return read.resolve(session, context.user, command)

    def _notice(self, payload):
        if self.closed:
            return
        try:
            self.notices.put_nowait(payload)
        except asyncio.QueueFull:
            # A missed live hint requires REST resync; never pretend it was delivered.
            for connection in list(self.connections.values()):
                connection.mailbox.offer(
                    {"kind": "PUBLIC", "message": {"type": "RESYNC_REQUIRED"}}
                )

    def _listen(self, loop):
        listened_before = False
        settings = self.app.state.settings
        url = settings.database_url.set(drivername="postgresql").render_as_string(
            hide_password=False
        )
        while not self.stop.is_set():
            try:
                # A thread works on Windows too; Psycopg async connections require a selector loop.
                with psycopg.connect(
                    url, autocommit=True, connect_timeout=3
                ) as connection:
                    connection.execute(f"LISTEN {CHANNEL}")
                    self.ready.set()
                    if listened_before:
                        loop.call_soon_threadsafe(self._notice, "RESYNC")
                    listened_before = True
                    while not self.stop.is_set():
                        for notice in connection.notifies(timeout=1, stop_after=50):
                            if not self.stop.is_set():
                                loop.call_soon_threadsafe(self._notice, notice.payload)
            except (psycopg.Error, OSError) as error:
                logger.warning(
                    "Realtime listener unavailable: %s", type(error).__name__
                )
                self.stop.wait(1)

    async def ensure_listener(self):
        async with self.start_lock:
            if self.thread is None:
                self.consumer = asyncio.create_task(self._consume())
                self.thread = threading.Thread(
                    target=self._listen,
                    args=(asyncio.get_running_loop(),),
                    daemon=True,
                    name="msv-listener",
                )
                self.thread.start()
        return await asyncio.to_thread(self.ready.wait, 3)

    def _describe(self, payload):
        with self.app.state.session_factory() as session:
            return read.describe(session, payload)

    async def _consume(self):
        while True:
            payload = await self.notices.get()
            if payload is None:
                return
            if payload == "RESYNC":
                for connection in list(self.connections.values()):
                    connection.mailbox.offer(
                        {"kind": "PUBLIC", "message": {"type": "RESYNC_REQUIRED"}}
                    )
                continue
            try:
                notice = await asyncio.to_thread(self._describe, payload)
            except SQLAlchemyError as error:
                logger.warning("Realtime hint unavailable: %s", type(error).__name__)
                continue
            if notice is None:
                continue
            for connection in list(self.connections.values()):
                if connection.user_id not in notice["audience"]:
                    continue
                if notice["kind"] == "EVENT":
                    connection.mailbox.offer({"kind": "EVENT", "id": notice["id"]})
                else:
                    connection.mailbox.offer({"kind": "STATE", "id": notice["id"]})
                    if connection.user_id == notice["owner"]:
                        connection.mailbox.offer(
                            {"kind": "OWN_LOCATION", "id": notice["id"]}
                        )
                    for request_id, vendor_id in list(connection.subscriptions.items()):
                        if vendor_id == notice["id"]:
                            connection.mailbox.offer(
                                {"kind": "LOCATION", "request_id": request_id}
                            )

    async def close(self):
        self.closed = True
        self.stop.set()
        for connection in list(self.connections.values()):
            connection.mailbox.offer({"kind": "CLOSE", "code": 1001})
        if self.thread:
            await asyncio.to_thread(self.thread.join, 4)
        if self.consumer:
            self.consumer.cancel()
            await asyncio.gather(self.consumer, return_exceptions=True)
