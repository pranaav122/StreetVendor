# Current API contracts

Updated 4 November 2026. Health, authentication, account, vendor, spatial discovery, visits, staff, devices and WebSockets are implemented. [Local verification](LOCAL_VERIFICATION.md) states actual results. Exact request/response fields and bounds are generated from the current code at [Swagger](http://127.0.0.1:8000/docs) and `/openapi.json`.

## Common rules

Business REST paths use `/api/v1`. JSON uses named latitude/longitude, UUID IDs and timezone-aware timestamps. Writes reject unknown fields. The server derives the actor from `Authorization: Bearer <access-token>` and checks the live account/session and resource authority. Clients cannot select roles, owners, verification or arbitrary visit state.

Creation uses a UUID `Idempotency-Key`; retries with the same payload return the same visit, while changed payload conflicts. Actions submit `expected_version`, refetching after conflict. Lists are bounded and actor scoped; nearby cursors are signed and bound to the user/query. Examples use synthetic coordinates; submit a current capture time, not a dated example timestamp.

Errors use `{ "error": { "code": "...", "message": "...", "request_id": "..." } }`. The matching `X-Request-ID` is server generated. Validation excludes submitted secret values. Statuses distinguish 401 authentication, 403 authority, 404 private/missing resources, 409 state/version conflict, 422 invalid input, 429 abuse limits and 503 dependency/configuration failures. Retry using existing idempotency/version rules rather than repeating arbitrary writes.

`GET /health` retains its separate readiness body: success is `{"status":"ok","database":"ok","postgis":"ok"}`; database failure returns 503 with database `unavailable` and PostGIS `unknown`; extension failure returns 503 with database `ok` and PostGIS `unavailable`. No credentials, SQL or version are disclosed.

## Feature contracts

| Feature | Authority and behavior |
|---|---|
| Registration/login | Public rate-limited fixed customer/vendor roles; no public admin registration. Password registration/reset minimum 15 characters, maximum 128 and 512 UTF-8 bytes; input is not silently trimmed. |
| Session | Access token lifetime 600 seconds; hashed opaque refresh family absolute lifetime 30 days, rotation/reuse/revocation. Recent authentication protects destructive actions. |
| Recovery | Generic reset request, purpose-bound single-use token confirmation, verified-email flow. Local mail is captured; production requires TLS SMTP. |
| Own account | Safe profile/language updates; explicit deletion confirmation anonymizes/revokes and erases affected location data. No role/status mass assignment. |
| Business | Vendor-owned profile/categories and minimal `evidence_note` review submission; staff approval/suspension/reinstatement is audited. No document-upload workflow. |
| Availability | Verified active vendor, explicit consent and first valid location commit atomically. Offline erases the exact point; later location writes require current sharing state. |
| GPS | At most 90 seconds old, at most 30 seconds future, accuracy at most 100 m, timezone-aware and newer than the stored reading. Updates are limited to 240 per 15-minute window per vendor (180 normal five-second updates plus bounded margin). |
| Discovery | Active customer, service-area origin, 100–5,000 m coarse radius, active category, current vendor eligibility; returns approximate location, kilometre band and capture time. No exact public GPS. |
| Visits | Active-pair uniqueness, guarded state/version/deadline and meeting-point privacy. Pending expires after five minutes; accepted work after sixty minutes. |
| Tracking | Only the visit's customer during accepted/approaching/arrived work with fresh eligible vendor. Unauthorized is 404; no longer eligible is 409 `TRACKING_UNAVAILABLE`. |
| Arrival | Server verifies two usable fixes five seconds apart within 50 m, age at most 30 seconds and accuracy at most 30 m. No public arbitrary arrival endpoint. |
| Reports/staff | Participants report their visit; staff resolves, inspects/cancels and manages suspensions with audit reasons. Counts are visits, not sales. |
| Devices | Native android/ios registration includes installation UUID, `app_kind`, `platform`, `project_id` and validated secret `token`; ownership includes current user/session family and selected app project. |

The main visit path is `PENDING → ACCEPTED → APPROACHING → ARRIVED → COMPLETED`. `DECLINED`, `CANCELLED` and `EXPIRED` are terminal alternatives. Clients use returned allowed actions; the server rechecks them on every write. Details: [authentication](AUTHENTICATION.md), [location](LOCATION.md), [visits](VISITS.md), [notifications](NOTIFICATIONS.md).

## WebSockets and staff browser boundary

Connect to `/api/v1/ws`; production uses WSS. Authenticate in the first bounded JSON message using `AUTHENTICATE` and an access token, never a URL token. Initial authentication requires REST resynchronization. Subscriptions, frames, heartbeat, queue sizes and connection counts are bounded; sending resolves current authorized state. See [REALTIME.md](REALTIME.md) for exact frames/close codes. This is a hint channel, not a durable replay endpoint.

The Staff Next server exposes `/api/session` and an allowlisted `/api/backend/...` proxy. Its browser cookie contains an opaque handle; tokens stay server-side. Mutations require exact Origin. Production login requires the private Caddy-overwritten client address and forwards it only from the reserved trusted Node address. Never publish that private Node hop. Backend authorization remains mandatory. See [ADMIN_APP.md](ADMIN_APP.md) and [PRODUCTION.md](PRODUCTION.md).

Notification jobs commit with events and call providers outside that transaction. Generic payloads contain IDs; taps refetch authorized current state. Tickets/receipts and retries cannot guarantee physical or exactly-once delivery.

## REST route index

The following paths were read from the running local OpenAPI schema on 4 November; WebSockets and Next routes are described separately above.

| Method | Path | Operation |
|---|---|---|
| GET | `/health` | Health |
| POST | `/api/v1/auth/register/customer` | Register Customer |
| POST | `/api/v1/auth/register/vendor` | Register Vendor |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/auth/logout-all` | Logout All |
| POST | `/api/v1/auth/password/reset/request` | Request Reset |
| POST | `/api/v1/auth/password/reset/confirm` | Confirm Reset |
| POST | `/api/v1/auth/email/verification` | Request Verification |
| POST | `/api/v1/auth/email/verify` | Verify Email |
| GET | `/api/v1/users/me` | Me |
| DELETE | `/api/v1/users/me` | Delete Me |
| PATCH | `/api/v1/users/me` | Update Me |
| PUT | `/api/v1/vendors/me/location` | Location |
| GET | `/api/v1/vendors/nearby` | Discovery |
| GET | `/api/v1/categories` | Categories |
| PUT | `/api/v1/vendors/me/profile` | Update Profile |
| GET | `/api/v1/vendors/me` | Own Profile |
| PATCH | `/api/v1/vendors/me/availability` | Availability |
| POST | `/api/v1/vendors/me/verifications` | Submit Verification |
| GET | `/api/v1/vendors/me/summary` | Own Summary |
| GET | `/api/v1/vendors/{vendor_id}` | Public Profile |
| GET | `/api/v1/admin/verifications` | Verifications |
| POST | `/api/v1/admin/vendors/{vendor_id}/verification` | Verification |
| POST | `/api/v1/admin/vendors/{vendor_id}/suspension` | Vendor Suspension |
| POST | `/api/v1/admin/vendors/{vendor_id}/reinstatement` | Vendor Reinstatement |
| GET | `/api/v1/admin/summary` | Summary |
| POST | `/api/v1/admin/users/{user_id}/suspension` | User Suspension |
| GET | `/api/v1/admin/reports` | Reports |
| POST | `/api/v1/admin/reports/{report_id}/resolution` | Resolution |
| POST | `/api/v1/admin/requests/{request_id}/cancel` | Staff Cancel |
| POST | `/api/v1/requests` | Create |
| GET | `/api/v1/requests` | Inbox |
| GET | `/api/v1/requests/{request_id}` | Detail |
| GET | `/api/v1/requests/{request_id}/vendor-location` | Tracking |
| POST | `/api/v1/requests/{request_id}/accept` | Accept |
| POST | `/api/v1/requests/{request_id}/decline` | Decline |
| POST | `/api/v1/requests/{request_id}/approach` | Approach |
| POST | `/api/v1/requests/{request_id}/complete` | Complete |
| POST | `/api/v1/requests/{request_id}/cancel` | Cancel |
| POST | `/api/v1/requests/{request_id}/reports` | Report |
| PUT | `/api/v1/devices/{installation_id}` | Register |
| DELETE | `/api/v1/devices/{installation_id}` | Deactivate |
