# MyStreetVendor complete MVP design

Date: 2 November 2026. Builds on the existing [architecture](../../ARCHITECTURE.md), [database](../../DATABASE.md), [API](../../API.md), and [security](../../SECURITY.md) designs. Those documents describe the intended feature contracts; this document defines delivery of the remaining project.

## Goal and present state

The user has authorized the remaining project after studying the foundation. The local repository contains the verified Phase 1 backend, migration baseline, tests, documentation, and handbook. It does not yet contain authentication, business features, mobile apps, or production infrastructure. The GitHub destination is `pranaav122/StreetVendor`, branch `main`.

Deliver an integrated MVP in which a customer can register, discover a verified available vendor, request a visit, follow its accepted progress, receive alerts, cancel or complete the visit, and inspect history. A vendor uses a separate app for registration, verification/profile, categories, availability, consent-based location, incoming requests, navigation and visit progress. An administrator verifies and suspends accounts and vendors and handles operational reports.

## Approach

Continue the existing modular monolith and self-hosted PostgreSQL/PostGIS. This is the approach already described in the architecture and selected technology stack. Replacing it with a managed backend or splitting into microservices would conflict with that stack and add migration work. Keep a single API process while realtime connections are owned in memory. Introduce no Redis, Kafka or Kubernetes in this release.

Use small feature files and explicit transactions rather than generic repository hierarchies. Keep two independent Expo projects and a small shared API client/types package. Share transport and contract code; each app owns its screens, navigation and permissions. Add a compact Next.js administration application after the mobile flows work.

## Implementation boundary

Deliver actual application code, migrations, tests, scripts, configuration and local demonstrations for the current MVP. Add production Compose/Caddy configuration, restricted database roles, backup/restore scripts, monitoring guidance and deployment instructions. Preserve the foundation tests and health contract.

Real external integration is configured through environment variables. Missing push, SMTP, maps or signing configuration must produce a clear disabled/unavailable state; a successful simulation cannot be reported as real device delivery. Actual public deployment requires the owner's VPS address/access and domain. Store submissions require owner accounts, application identifiers and signing credentials. Physical Android/iOS background operation requires device testing. These are explicit release gates, not reasons to invent credentials or claim completion of an unrun check.

Payments, sales accounting, inventory, public OTP, group requests, route optimization, demand aggregation and multi-city operations tooling remain later product work from the original brief. Completing a visit never records a sale. Navigation initially opens a meeting point in the device's maps application.

## Backend contracts and ownership

Application entry remains `app.main:create_app`. Shared configuration and one session per request remain in `app/config.py` and `app/database.py`.

| Module | Files | Owns |
|---|---|---|
| Models | `backend/app/models/` | Application tables, relationships and named constraints; import models into Alembic explicitly |
| Authentication | `backend/app/auth/` | Password hashing, JWT, refresh rotation, revocation and authenticated actor dependency |
| Users | `backend/app/users/` | Own profile, deletion and consent-compatible data handling |
| Vendors | `backend/app/vendors/` | Profiles, localized categories, verification and atomic online/offline changes |
| Location | `backend/app/location/` | Validated latest fixes, nearby PostGIS search, coarse discovery and authorized tracking |
| Visits | `backend/app/visits/` | Transactional state machine, idempotency, event history, expiry and arrival |
| Realtime | `backend/app/realtime/` | Authenticated WebSocket lifecycle, authorized subscriptions and bounded queues |
| Notifications | `backend/app/notifications/` | Device registrations, durable per-device outbox, Expo tickets/receipts and retries |
| Administration | `backend/app/admin/` | Operator bootstrap, verification, suspension, reports and audit records |
| Operational jobs | `backend/app/jobs.py` | Bounded expiry, retention and notification processing in one API process |

REST contracts remain in `docs/API.md`. All business write models reject unknown fields. The acting user is derived from the token. Clients cannot assign roles, verification, ownership, terminal timestamps or arbitrary visit state. Authorization failures never expose another participant's private point.

### Authentication

Use Argon2id through `pwdlib[argon2]` and signed JWT access tokens through PyJWT, following current FastAPI guidance. Use random opaque refresh tokens and store only their hashes. Access lifetime is 600 seconds; a refresh family has an absolute lifetime of 30 days. Validate issuer, audience, algorithm, expiry and live session/account status. Rotate refresh rows under a lock and revoke the family on confirmed reuse. Specify client refresh coordination to avoid two independent simultaneous refreshes on one device.

Provide customer/vendor registration routes, login, refresh, logout, logout-all, own profile and account deletion. Password reset and email confirmation use one-time hashed tokens and a real SMTP adapter when configured; production does not print delivery tokens or passwords. Add database-backed bounded rate limits so restarting the API does not reset authentication abuse counters. A CLI reads an admin password interactively and creates an operator without public admin registration.

### Vendors and locations

Keep canonical lowercase roles `customer`, `vendor`, `admin`; account and visit status strings remain uppercase. Vendor verification and availability are separate. Going online requires a verified active vendor, explicit sharing and a first usable fix committed atomically. Going offline disables sharing and deletes the latest exact fix in the same transaction.

Retain `geography(Point,4326)` with longitude-first construction and GiST indexing. Defaults from the existing design are: maximum fix age 90 seconds, future tolerance 30 seconds, accuracy at most 100 metres, non-increasing timestamps rejected or treated as exact duplicate retries. Discovery filters current verification, availability, consent, account status and freshness; returns coarse locations and distance bands, with capped radius/results and a signed cursor bound to the search. Exact tracking requires an active accepted request and rechecks authorization for each response/event.

Service area is explicit configuration. For local development, use a synthetic test rectangle spanning latitude 13.00 to 13.20 and longitude 80.15 to 80.35, which contains the documented Chennai test fixtures. This is a builder-selected development boundary, not an assertion about municipal boundaries or an agreed public operating area. Production must require an owner-approved service-area polygon and reject discovery origins and meeting points outside it. The public release gate stays closed until that area is supplied.

Arrival requires two usable fixes at least 5 seconds apart, within 50 metres, at most 30 seconds old, each with accuracy at most 30 metres. Record only minimal transient arrival candidate data, not a route history. Operating-system suspension never implies guaranteed GPS delivery.

Independent Wolfram WGS84 calculations for the synthetic point `(latitude 13.0827, longitude 80.2707)` give approximately 48.801925 metres to longitude `80.27115` and 108.448723 metres to longitude `80.2717`, at the same latitude. Use tolerances around these values as cross-check fixtures; PostGIS remains the actual application query engine.

### Visit state and notifications

Implement the allowed actor transition matrix already in `docs/API.md`. Enforce one active customer/vendor pair, creation idempotency keys with payload hashes, expected-version changes and row-lock/conditional-update concurrency. Pending requests expire after 5 minutes; accepted visits after 60 minutes by default. State, event and outbox changes commit together once notifications are enabled. Provider delivery is outside that transaction.

Device tokens have authenticated ownership and app-kind separation. Outbox uniqueness is `(request_event_id, device_token_id, channel)`. Use leases and bounded backoff, poll receipts, disable permanent invalid tokens, and recheck ownership/relevance before sending. External delivery is best effort; retries may duplicate alerts. WebSockets authenticate through a bounded initial frame rather than query-string tokens, authorize each subscription, expire/revoke access and resynchronize through REST after reconnect.

### Retention and administration

Retain only the latest vendor fix; remove it when sharing stops. Redact meeting points and labels within 24 hours after termination, retain minimal visit/event history for 90 days, remove completed notification payloads after 7 days and disabled device registrations after 30 days. Cleanup must preserve active requests and required referential integrity. Accounts are initially anonymized/revoked, with an explicit purge process for dependent records.

Add narrowly scoped report and administrative audit tables for the requested report handling and suspension history. Administrative actions require a live admin role, deny self-verification, and record actor, reason and time. No government-document upload is enabled before private storage and deletion policy are configured; the initial verification workflow uses minimal staff-reviewed metadata.

## Customer and Partner applications

Both apps use Expo Router, strict TypeScript, TanStack Query, React Hook Form/Zod, SecureStore, Location and Notifications. Use the stable mutually compatible Expo package set checked at implementation time and commit the package lock. Give each app separate configuration, package identifiers, navigation and EAS profiles. A shared package provides validated API functions and types, a coordinated refresh mechanism and event schemas.

Customer screens: registration/login, selected location and permission states, nearby map/list and category filters, vendor details, visit creation, current status, authorized tracking, cancellation, history, account/preferences and deletion. Selected meeting points remain usable without forcing home-address disclosure.

Partner screens: registration/login, bilingual English/Tamil profile and verification, dashboard, category selection, availability with visible sharing status, incoming requests, accepted meeting points and external navigation, progress/completion, history/daily visit counts and account/preferences. Use large touch targets, clear language and a visible offline/degraded state.

Background tasks are defined at module scope and configured for development builds. Stop sharing on logout/offline; recheck permission/account/server state on app resume. Handle denial, poor accuracy, expired credentials, network loss and reconnect. Do not represent stale points as live. A web preview can validate some UI flows, but cannot establish native background GPS or remote push behavior.

## Visual design and Figma

Create a restrained mobile design system using readable typography, warm neutral surfaces and a dark green primary action color. Treat these as builder-selected defaults, not an existing brand asset. Validate contrast, large touch targets, Tamil wrapping and all loading/empty/error/permission states.

Use the connected Figma account for a shared design reference with separate Customer and Partner pages and key workflow screens. Confirm write capability before creating/editing a file. A permission failure must be reported; code generation and tests should continue from the recorded design decisions without falsely claiming a Figma deliverable. The existing account connection has been checked; no new design file has been created during planning.

## Administration and production

Add `apps/admin-dashboard` with verification queue, reports, suspensions, request inspection and operational summaries. Keep admin secrets out of browser storage: use a server-side proxy/session boundary with HTTP-only secure cookies and origin/CSRF checks. The backend still performs all authorization and audit checks.

Production runs a single FastAPI process behind Caddy on an Ubuntu VPS, with private PostgreSQL, persistent volumes, separate migration/runtime credentials, HTTPS/WSS, structured logs and bounded jobs. Provide backup and isolated restore scripts plus a local restore rehearsal. A production smoke test must verify the real hostname and TLS once server access is supplied.

## Verification and completion evidence

Use tests that fail for the missing behavior before implementing it, then run focused checks and integration suites. Real PostgreSQL/PostGIS tests cover migrations, auth/session revocation, ownership, spatial boundaries, stale fixes, state concurrency, arrival, terminal privacy and outbox failure recovery. Mobile checks include TypeScript, unit/component tests and an integrated local workflow. Native hardware/provider/server checks are recorded separately.

Run Codex Security on the complete changed application, validate findings and repair confirmed defects before calling the local software complete. Keep the security report and coverage honest about unavailable external checks. Use No AI Slop when editing UI text and documentation.

After each coherent verified change, commit and push to `origin/main` and confirm the remote commit matches. Do not force push or commit secrets. Update documentation and implementation status as features become real. Keep the foundation handbook as a clearly dated edition; add a later handbook/update rather than silently pretending its Phase 1 snapshot describes the finished MVP.

## Release inputs still supplied by the owner

- Domain, VPS address and authorized deployment access.
- Approved pilot neighbourhood/service-area polygon for production discovery and meeting points.
- Expo/EAS project ownership, final Android/iOS identifiers, signing and push credentials.
- Map provider keys when required by the selected native map configuration.
- SMTP credentials and sender/domain verification for real mail delivery.
- Physical Android/iOS devices, permissions and consent for real-device checks.
- Pilot/support ownership and release-account approvals.

These inputs will be requested when their integration is ready to verify. They are never represented by hardcoded production placeholders.
