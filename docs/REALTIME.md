# Authenticated realtime delivery

The API exposes `/api/v1/ws`. Production uses WSS behind Caddy. Local tests use loopback WS. [FastAPI provides the WebSocket transport](https://fastapi.tiangolo.com/advanced/websockets/); MyStreetVendor supplies authentication, ownership checks and message limits.

The first frame must arrive within five seconds:

```json
{"type":"AUTHENTICATE","access_token":"<access-token>"}
```

The server validates the JWT and current account/session in PostgreSQL before replying `AUTHENTICATED`. It includes a connection ID, expiry and `resync_required: true`. Tokens in the URL and untrusted browser origins are rejected. Production customer/vendor sessions also require verified email. Reauthentication may renew the same account and session family; account switching needs a new socket.

Each authenticated connection receives its own request-inbox events. A participant can additionally send `SUBSCRIBE_REQUEST` with a request UUID for active accepted/approaching/arrived tracking. A pending request still receives progress through the inbox. `UNSUBSCRIBE_REQUEST` removes tracking, including queued location hints. Clients send `PING` with a UUID every 25 seconds; the server returns `PONG`. Sixty seconds without an application heartbeat ends the connection.

## How a committed change reaches a phone

1. A service writes the request state and immutable event in one transaction.
2. It calls `pg_notify` with the event ID. PostgreSQL delivers the hint only after commit; rollback discards it. This behavior is documented in the [PostgreSQL 18 notification reference](https://www.postgresql.org/docs/18/sql-notify.html).
3. A lazy listener uses one autocommit database connection on a dedicated thread. This keeps listening compatible with Windows event loops and leaves no long-running database transaction open.
4. The manager routes ID-only hints into bounded per-connection mailboxes. A worker fetches the event or point through a short session, rechecks live authorization and sends the JSON frame.

Coordinates never enter a queued hint. Terminal transitions remove the tracking subscription. Offline, stale or suspended vendor state cannot produce an exact point. Logout, expiry and account suspension close affected sockets; every outgoing response also rechecks the live session. A slow client is disconnected rather than accumulating messages.

REST holds durable state. Sockets provide live hints and can miss changes during a disconnect. On reconnect or `RESYNC_REQUIRED`, refetch the inbox/request and subscribe again. Apply request versions and GPS capture times so old events cannot overwrite newer state. The process keeps no durable replay of private GPS frames.

## Limits and close codes

The defaults allow 100 connections in the process, ten per IP, three per account, ten tracking subscriptions per connection, 8,192 bytes per frame and 32 queued hints. Uvicorn explicitly runs one worker and bounds its protocol queue too. A send can wait at most one second. Adjusting production capacity requires measuring database load and the single-process arrival/realtime design.

| Code | Meaning |
|---|---|
| `1008` | URL query or browser origin rejected |
| `1009` | Frame too large |
| `4400` | Invalid protocol message |
| `4401` | Missing, invalid, expired or revoked authentication |
| `4403` | Account lacks realtime access |
| `4408` | Application heartbeat missing |
| `4429` | Connection, queue or send limit reached |
| `1013` | Temporary dependency failure; reconnect with backoff |

## Debug without exposing tokens

Run the real TCP isolation test from PowerShell:

```powershell
$env:RUN_DB_TESTS = '1'
.\.venv\Scripts\python.exe -m pytest -c backend/pyproject.toml backend/tests/test_websocket_network.py -q
Remove-Item Env:RUN_DB_TESTS
```

It starts a loopback Uvicorn server against a disposable database, authenticates two independent clients, checks a committed versioned event and proves the other customer receives no such event. The protocol suite checks auth deadlines, revocation, expiry, terminal privacy, unsubscribe, reconnect and backpressure. This verifies server behavior; it does not establish real mobile push or background operation.

Use `app/realtime/router.py` for protocol/cleanup, `manager.py` for bounds and listener lifecycle, `read.py` for live authorization, and `signals.py` for transactional ID hints. Inspect close codes and safe error classes. Never put access tokens in URLs or print real private location frames into shared logs.
