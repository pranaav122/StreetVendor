# API contracts

Phase 0 design, 21 October 2026. Only the Phase 1 health endpoint is implemented by this milestone. Every `/api/v1/...` route and the WebSocket protocol below is **planned**. Swagger at `/docs` and `/openapi.json` describe the routes actually present in the running server; this document also records future contracts.

## Phase 1: health

`GET /health` is public and performs real database queries. It is a readiness check, not proof that every future business feature is working.

| HTTP status | JSON body | Meaning |
|---|---|---|
| `200` | `{"status":"ok","database":"ok","postgis":"ok"}` | PostgreSQL responds and PostGIS can execute its version function. |
| `503` | `{"status":"error","database":"unavailable","postgis":"unknown"}` | A connection/query needed to establish database connectivity failed. |
| `503` | `{"status":"error","database":"ok","postgis":"unavailable"}` | PostgreSQL responds, but PostGIS is missing or its check fails. |

The response never contains a database URL, credentials, SQL, exception details, or extension version. API logs explain the failing component without logging credentials. A newly created SQLAlchemy engine alone does not establish a network connection; the health queries do.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

## Shared rules for future REST endpoints

- JSON bodies and responses; UUID IDs; timezone-aware ISO 8601 timestamps in UTC. Coordinates are named `latitude` and `longitude` in JSON so clients do not guess their order.
- Authentication uses `Authorization: Bearer <access-token>`. Access token claims identify the user and session; the backend also checks the live user/session status. Roles are `customer`, `vendor`, and `admin` and are assigned by the server.
- The server derives the acting user's ID from authentication. A body field such as `customer_id`, `role`, `is_verified`, or `created_by` cannot impersonate another user or grant privileges.
- Unknown fields in business write models will be rejected. Validate lengths and numeric bounds before database work. Apply authorization to each resource, not merely to the route name.
- Lists use `limit` (default 20, maximum 100) and an opaque cursor. Responses use `{ "items": [...], "next_cursor": null }`. Nearby search is capped at 50 items and uses its own location-bound cursor.
- Documented examples contain synthetic values. Tokens shown as placeholders are never real credentials.
- Request creation accepts `Idempotency-Key` (UUID). Bind it to the customer and canonical payload hash. Reusing a key with a different payload returns `409`; retries of the same committed creation return the original result. Transitions use `expected_version`; after an ambiguous timeout, fetch current state before retrying. A repeated transition cannot create a second event for the same request version.

Planned common errors:

| Status | Meaning |
|---|---|
| `400` | Invalid operation that is not a field validation error. |
| `401` | Missing/expired/invalid credentials; include `WWW-Authenticate: Bearer` for REST authentication failures. |
| `403` | The authenticated actor cannot perform an operation. |
| `404` | Resource absent or intentionally hidden from a non-participant. |
| `409` | State/version conflict, duplicate active request, or idempotency payload mismatch. |
| `422` | Request validation failed. |
| `429` | Rate limit reached; return `Retry-After`. |
| `503` | Required database/provider dependency unavailable; avoid leaking internal details. |

A consistent future business error is `{ "error": { "code": "REQUEST_STATE_CONFLICT", "message": "The request has changed.", "request_id": "<trace-id>" } }`. This envelope is **not installed in Phase 1**. Framework-generated validation errors currently follow FastAPI's normal `detail` structure. Future validation errors must redact passwords and tokens rather than echo their submitted values.

## Authentication and accounts — Phase 2 planned

| Method and path | Actor | Input / validation | Success |
|---|---|---|---|
| `POST /api/v1/auth/register/customer` | Public, rate limited | `email`, `password`, `display_name`, `preferred_language` (`en`/`ta`); normalized email, bounded strings, password policy in SECURITY.md | `201` minimal user; role fixed to `customer` |
| `POST /api/v1/auth/register/vendor` | Public, rate limited | Same account fields; no verification or role input | `201` vendor user; vendor verification remains pending |
| `POST /api/v1/auth/login` | Public, rate limited | `email`, `password`, optional bounded `device_name` | `200` token response |
| `POST /api/v1/auth/refresh` | Holder of refresh token, rate limited | `refresh_token`; rotate under a database row lock | `200` replacement access and refresh tokens |
| `POST /api/v1/auth/logout` | Authenticated session | No user ID; revoke acting session family | `204`; repeated revocation is safe |
| `POST /api/v1/auth/logout-all` | Authenticated user, recent authentication | No body | `204`; revoke all user's session families |
| `GET /api/v1/users/me` | Any active account | None | `200` own safe profile |
| `PATCH /api/v1/users/me` | Any active account | Only `display_name`, `preferred_language`; no role/status | `200` updated safe profile |
| `DELETE /api/v1/users/me` | Any account, recent authentication | Explicit deletion confirmation | `202` accepted deletion; suspend access and revoke tokens immediately |

Token response: `{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 600, "refresh_token": "<opaque-secret>" }`. Starting policy: access lifetime 10 minutes, refresh family absolute lifetime 30 days; tune from security review. Registration does not grant verified email or vendor status. Email verification and password recovery require a real delivery provider before public launch; mobile OTP is a later provider-backed feature.

## Vendor management — Phase 3 planned

| Method and path | Actor | Input / validation | Success |
|---|---|---|---|
| `GET /api/v1/categories` | Active customer/vendor | Optional cursor/limit | `200` active categories with localized labels |
| `PUT /api/v1/vendors/me/profile` | Vendor | `display_name`, short `description`, `category_ids`; existing active category UUIDs | `200` own profile; create once or update allowed fields |
| `GET /api/v1/vendors/me` | Vendor | None | `200` own profile including verification and availability |
| `PATCH /api/v1/vendors/me/availability` | Verified vendor | `is_available`, `location_sharing_enabled`; enabling also includes the first validated `location` fix, committed atomically with online state | `200` server-confirmed state |
| `GET /api/v1/vendors/{vendor_id}` | Customer/vendor | UUID | `200` public business profile; no email, credentials, device tokens or precise discovery position |
| `POST /api/v1/vendors/me/verifications` | Vendor | Bounded verification metadata via private upload workflow; no public document URL | `201` pending verification record |
| `GET /api/v1/admin/verifications` | Admin | Status/cursor/limit | `200` minimal review queue |
| `POST /api/v1/admin/vendors/{vendor_id}/verification` | Admin | `decision` (`VERIFIED`/`REJECTED`), `reason` | `200` audited review under a vendor-row lock; never self-approval |
| `POST /api/v1/admin/vendors/{vendor_id}/suspension` | Admin | `reason` | `200` audited profile suspension; turn off availability/sharing and revoke tracking in one transaction |
| `POST /api/v1/admin/users/{user_id}/suspension` | Admin | `suspended`, bounded `reason`; audit actor | `200`; revoke affected access/subscriptions |

To go online, submit `is_available: true`, `location_sharing_enabled: true` and a `location` object with the same fields and validation rules as the location endpoint below. Under one transaction, confirm the active verified vendor and explicit consent, validate the first fix, then set availability/sharing and upsert the fix. This bootstrap operation does not require an existing online state or stored fix. Later location-only updates require the vendor already be online. Going offline atomically disables availability/sharing and deletes the precise latest fix, immediately hiding discovery and precise tracking. Existing visits remain recorded and participants receive unavailable status; the backend does not mark them completed. Category administration and report handling can be added behind audited admin routes when required.

## Location and discovery — Phase 4 planned

`PUT /api/v1/vendors/me/location` requires the authenticated, verified vendor, online availability, and active sharing consent. The server checks its stored consent state; a submitted permission flag is only device telemetry.

```json
{
  "latitude": 13.0827,
  "longitude": 80.2707,
  "captured_at": "2026-10-21T09:30:00Z",
  "accuracy_m": 15.0
}
```

Validation: latitude `[-90,90]`, longitude `[-180,180]`, timezone-aware timestamp, finite nonnegative accuracy. Starting pilot limits: reject observations older than 90 seconds, over 30 seconds in the future, poorer than 100 metres accuracy, or no newer than the vendor's already accepted observation. The server records `received_at` and conditionally upserts only a newer observation in one transaction. Duplicate or out-of-order observations return `409 LOCATION_OUT_OF_ORDER` and do not overwrite the latest fix. Success is `200` with accepted observation time and tracking status; a stale/poor observation is `422` with a specific safe code. Add per-vendor update limits.

`GET /api/v1/vendors/nearby?latitude=13.0827&longitude=80.2707&radius_m=1500&limit=20&category_id=<uuid>` requires an active customer. Radius starts at 100–5,000 metres. Apply validated category filtering, `VERIFIED`, `is_available`, sharing consent and fresh accurate locations in the **database query**. The service never allows a client to include unverified/offline vendors by supplying filters. Use indexed PostGIS geography, bounded sorting by distance then ID, and an opaque cursor bound to the same search point/filter set and a short expiry. Discovery is changing data, not an immutable page snapshot; refresh rather than treating a cursor as a long-term list.

Response items: `vendor_id`, `display_name`, `categories`, `approximate_location`, `distance_band_m`, `location_updated_at`. Discovery displays a coarse map region and distance band, not exact GPS or distance. Rate-limit searches and coordinate changes; rounding alone does not prevent triangulation. See DATABASE.md for metre-based query design.

`GET /api/v1/requests/{request_id}/vendor-location` returns `{ "latitude", "longitude", "accuracy_m", "captured_at" }` only to that request's customer while the request is active (`ACCEPTED`, `APPROACHING`, `ARRIVED`), the vendor is online/sharing, and the position remains fresh. A stale position returns an explicit unavailable result without a precise point. Return `404` to non-participants and `409 TRACKING_UNAVAILABLE` when an authorized request no longer qualifies. Check again for every read and outgoing socket event.

## Visit requests — Phase 5 planned

| Method and path | Actor | Input / validation | Success |
|---|---|---|---|
| `POST /api/v1/requests` | Customer | `vendor_id`, `meeting_point` (`latitude`, `longitude`), optional short `meeting_label`; idempotency header | `201` `PENDING` request with expiry/version |
| `GET /api/v1/requests` | Customer/vendor | `status`, cursor, limit; actor-scoped query | `200` own request history/inbox |
| `GET /api/v1/requests/{id}` | Request participant/admin | UUID; authorize ownership | `200` current state, version and allowed actions |
| `POST /api/v1/requests/{id}/accept` | Target vendor | `expected_version` | `200` `ACCEPTED` |
| `POST /api/v1/requests/{id}/decline` | Target vendor | `expected_version`, optional bounded reason | `200` `DECLINED` |
| `POST /api/v1/requests/{id}/approach` | Target vendor | `expected_version` | `200` `APPROACHING` |
| `POST /api/v1/requests/{id}/cancel` | Customer/target vendor | `expected_version`, bounded reason | `200` `CANCELLED` |
| `POST /api/v1/requests/{id}/complete` | Target vendor | `expected_version`; only from `ARRIVED` | `200` `COMPLETED` visit |

Meeting points must be within the supported service area and sensible request distance. They are shared only with the target vendor/authorized administrators for the visit, never through discovery. A request response includes `id`, `vendor_id`, participant-safe profile fields, `status`, `version`, `created_at`, `expires_at`, `meeting_point`, and `allowed_actions`; server authorization is still required even if a client submits an action it displayed earlier.

| From | To | Allowed actor / condition |
|---|---|---|
| No record | `PENDING` | Customer; discoverable vendor, valid meeting point, no active request for this customer/vendor pair |
| `PENDING` | `ACCEPTED` | Target vendor; before pending expiry |
| `PENDING` | `DECLINED` | Target vendor |
| `PENDING` | `CANCELLED` | Creating customer or target vendor |
| `PENDING` | `EXPIRED` | Server after pending deadline, initially 5 minutes |
| `ACCEPTED` | `APPROACHING` | Vendor's explicit action or backend distance evaluation using fresh accurate GPS |
| `APPROACHING` | `ARRIVED` | Server only; confirmed arrival rule below |
| `ARRIVED` | `COMPLETED` | Target vendor confirms visit finished |
| `ACCEPTED`, `APPROACHING`, `ARRIVED` | `CANCELLED` | Customer or target vendor; store actor/reason |
| `ACCEPTED`, `APPROACHING`, `ARRIVED` | `EXPIRED` | Server after active visit deadline, initially 60 minutes from acceptance |

`DECLINED`, `CANCELLED`, `EXPIRED`, and `COMPLETED` are terminal. A new visit needs a new request. No other transition is accepted. If there is a safety/support intervention, use an explicit audited admin cancellation operation rather than arbitrary status edits.

Arrival pilot rule: within 50 metres of the meeting point for two usable observations at least 5 seconds apart, each no older than 30 seconds with accuracy at most 30 metres. Treat poor/stale GPS as uncertainty, not arrival. Use server-side PostGIS distance. The server may advance through `APPROACHING` before arrival in the same evaluation transaction if all conditions hold. Tune thresholds using simulated movement and physical-device measurements in Phase 4/7. A visit is not evidence of a purchase.

For each transition: lock or conditionally update the request with expected status/version; verify actor, deadline, and vendor state; increment version; insert the immutable `request_events` record; commit; then emit live events once Phase 6 exists. Phase 7 adds the outbox table and includes relevant notification entries in the same transaction from that phase onward. Return `409` if another actor already changed it. A partial unique index protects one active request per customer/vendor pair. A vendor may have multiple customer requests; route planning is later work. Expiry evaluation runs on reads/writes and a small periodic server task; a disconnected phone cannot keep a request alive indefinitely.

## Realtime — Phase 6 planned

Endpoint: `WSS /api/v1/ws`. Development can use `ws://` only on the trusted local network. No access token in a URL or query string.

1. Accept an unauthenticated connection with strict connection/IP limits and a 5-second authentication deadline. Send no private information yet.
2. The first JSON message is `{ "type": "AUTHENTICATE", "access_token": "<jwt>" }`. Verify signature, issuer/audience, expiry, live account/session and socket origin where applicable. Close with application code `4401` on failure; do not echo credentials.
3. Reply `{ "type": "AUTHENTICATED", "connection_id": "<uuid>", "expires_at": "<utc>" }`. The server attaches the actor's own inbox subscriptions, not caller-chosen user IDs.
4. A customer can request `{ "type": "SUBSCRIBE_REQUEST", "request_id": "<uuid>" }`. Authorize participation and tracking eligibility before subscribing. A vendor is restricted to its own requests. Unauthorized subscriptions return `FORBIDDEN` without private data. `UNSUBSCRIBE_REQUEST` removes the subscription.
5. Authenticate again using a fresh access token before expiry; otherwise close `4401`. Logout/suspension and terminal request transitions remove affected subscriptions immediately. All outgoing location events recheck eligibility.

Client heartbeat every 25 seconds: `{ "type": "PING", "id": "<uuid>" }`; server responds `PONG` with the same ID. Close connections with no heartbeat for 60 seconds. Bound message size, subscriptions and queued sends; disconnect slow consumers. Do not keep a SQLAlchemy session/transaction open for a socket lifetime.

Business event envelope:

```json
{
  "event_id": "<uuid>",
  "type": "REQUEST_ACCEPTED",
  "occurred_at": "2026-10-21T09:31:00Z",
  "request_id": "<uuid>",
  "request_version": 2,
  "data": { "status": "ACCEPTED" }
}
```

| Event type | Audience | Minimal data |
|---|---|---|
| `VENDOR_ONLINE`, `VENDOR_OFFLINE` | Own vendor session and eligible request participants | Vendor ID and availability; no public exact point |
| `REQUEST_CREATED` | Target vendor and creating customer | Request ID, status, version; fetch authorized details by REST |
| `REQUEST_ACCEPTED`, `REQUEST_DECLINED`, `REQUEST_CANCELLED`, `REQUEST_EXPIRED`, `REQUEST_COMPLETED` | Request participants | Status/version, safe reason if applicable |
| `VENDOR_LOCATION_UPDATED` | Active request customer and own vendor session | Coordinates, accuracy, observation time; only while tracking is authorized |
| `VENDOR_ARRIVED` | Request participants | Status/version and arrival time |
| `REQUEST_APPROACHING` | Request participants | Status/version; approaching alert |

Event IDs deduplicate delivery; request versions prevent an older event overwriting newer state. Location events use observation time as a further ordering key. Reconnect with exponential backoff and jitter, capped around 30 seconds. After reconnect/authentication, refetch REST inbox and active request details before resubscribing. In-memory sockets are a live hint channel, not a durable replay log; there is no promise of delivery while disconnected. A future replay endpoint can use persisted request events with actor-scoped cursors. Redis pub/sub is introduced only when running multiple API instances; it does not replace database state or authorization.

## Device notifications — Phase 7 planned

| Method and path | Actor | Input / validation | Success |
|---|---|---|---|
| `PUT /api/v1/devices/{installation_id}` | Active account | `app_kind` (`customer`/`vendor`), platform, provider token; validate ownership and project/provider format | `200` own device registration |
| `DELETE /api/v1/devices/{installation_id}` | Installation owner | None | `204`; idempotent removal |

Register tokens after explicit OS permission. Bind ownership to the authenticated account and app; a token moving accounts cannot remain attached to both. Remove association on logout and clean invalid tokens on provider receipts. Notification payloads contain a notification ID and request ID, without precise coordinates or credentials. Fetch authorized current details when opening the notification.

Committed events create durable outbox jobs, one per eligible device. Delivery retries use bounded exponential backoff, attempt records and a unique `(request_event_id, device_token_id, channel)` key, allowing the same recipient's multiple registered devices to receive alerts. Provider tickets/receipts distinguish acceptance from downstream failure; phone delivery is not guaranteed. A timeout can leave acceptance ambiguous, so duplicate external delivery is still possible; deduplicate notification IDs on the device where feasible. Expo describes its server API and receipt handling in its [official sending guide](https://docs.expo.dev/push-notifications/sending-notifications/).

## Contract validation by phase

Phase 1 tests verify `/health` and database/migrations. Later phase tests must cover authorization on every route, token/session expiry, refresh races/reuse, invalid transitions, concurrent acceptance/cancellation, stale GPS, privacy, socket authorization, reconnect synchronization and duplicate notifications. Do not describe these later tests as passing before they exist.
