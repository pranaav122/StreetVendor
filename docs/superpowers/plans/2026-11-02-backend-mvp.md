# MyStreetVendor backend MVP implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement and verify the remaining REST, spatial, request, realtime and notification behavior on the existing foundation.

**Architecture:** Feature routers call small services that own explicit SQLAlchemy transactions. PostgreSQL owns durable state/events/outbox; one API process owns bounded realtime connections and transient arrival candidates.

**Tech Stack:** Existing Python 3.13/FastAPI/SQLAlchemy/Psycopg/Alembic/PostGIS, pwdlib Argon2id, PyJWT, HTTPX2 and Pytest.

**Spec:** [Complete MVP design](../specs/2026-11-02-complete-mvp-design.md) and existing API/database/security contracts.

## Global constraints

All constraints in [the complete plan](2026-11-02-complete-mvp.md) apply, including exact time/freshness/privacy defaults and commit/push after each coherent verified change. Integration tests use generated disposable real PostgreSQL databases, never SQLite for spatial/concurrency assertions and never downgrade the development database.

## Review focus

- Auth revocation must apply immediately to HTTP and socket access.
- Failed transactional changes must not leave state without an audit event or vice versa.
- Invalid floats, cursor tampering and out-of-order fixes must fail safely.
- Jobs must survive API restart without replaying obsolete private events to a new device owner.
- Retention must redact sensitive points without erasing active workflow state.

## Task 1 Authentication and own account

**Files:** Create `backend/app/models/accounts.py`, `backend/app/auth/{schemas,security,service,router,dependencies}.py`, `backend/app/users/{schemas,router}.py`, `backend/app/cli.py`, migration `0002_accounts.py`, tests `test_auth.py`, `test_users.py`; modify config, dependency pins, migration imports and application composition.

**Interfaces:** `get_current_user(request, session) -> User`; `require_role(*roles) -> dependency`; `issue_session(session, user, device_name) -> TokenResponse`; `TokenResponse` has access token, refresh token, bearer type and 600-second expiry. Existing `/health` stays unchanged. Store refresh hashes and live family/account status; never trust JWT role alone.

- [ ] Write failing integration cases for fixed registration roles, duplicate normalized email, Argon2 hash storage, invalid/expired access, refresh rotation/reuse, logout-all, suspension/deletion, unknown input fields and redacted validation errors. Assert `expires_in == 600`, old refresh reuse rejects and revokes its family, and submitted `role=admin` is rejected.
- [ ] Run `python -m pytest backend/tests/test_auth.py backend/tests/test_users.py -c backend/pyproject.toml` with `RUN_DB_TESTS=1`; confirm missing behavior fails.
- [ ] Implement account models/migration, hashing/JWT/session functions and routes, PostgreSQL rate-limit buckets, one-time mail-token/SMTP adapter, safe recent-auth checks and interactive admin bootstrap. Extend settings with required signing/mail configuration without changing the existing database environment.
- [ ] Re-run focused cases plus foundation tests, fresh migration upgrade and schema check. Exercise configured mail through a test SMTP transport and record real mail as a separate release check.
- [ ] Commit and push the verified authentication/account change; compare local/remote SHA.

## Task 2 Vendor profiles categories and administration

**Files:** Create `backend/app/models/vendors.py`, `backend/app/models/locations.py`, `backend/app/location/{schemas,validation}.py`, `backend/app/vendors/{schemas,service,router}.py`, `backend/app/admin/{schemas,service,router}.py`, migration `0003_vendors_and_locations.py`, tests `test_vendors.py`, `test_admin.py`.

**Interfaces:** Protected routes from `docs/API.md`; `set_availability(session, actor, payload) -> VendorState` atomically writes first fix and sharing state. Introduce `validate_fix(payload, now) -> ValidatedFix`, the latest-location model and GiST index here so atomic availability is independently working before discovery is added.

- [ ] Write failing tests for vendor ownership, localized active categories, pending verification, rejected self-approval, admin-only decisions, online-first-fix bootstrap, offline exact-fix deletion and audited suspension.
- [ ] Run the focused files with integration enabled and confirm the intended failures.
- [ ] Implement models/constraints and services, including the location prerequisite. Add seed categories through an idempotent CLI, not a public admin-escalation route. Add administrative audit records for verification/suspension; defer visit-linked report records to task 4 so their foreign keys reference existing visit tables.
- [ ] Run focused/foundation/auth cases and upgrade/schema comparison; assert a racing offline operation cannot leave a discoverable fix.
- [ ] Commit and push the verified vendor/admin change.

## Task 3 Spatial updates discovery and authorized tracking

**Files:** Extend `backend/app/location/{schemas,validation}.py`; create `backend/app/location/{service,router}.py`, `backend/scripts/simulate_gps.py`, tests `test_locations.py`, `test_discovery.py`, `test_location_privacy.py`. Reuse the model/index already migrated in task 2; this task needs no empty migration.

**Interfaces:** `validate_fix(payload, now) -> ValidatedFix`; `record_fix(session, vendor, fix) -> LocationResult`; `nearby(session, actor, search) -> VendorPage`; signed search-bound cursors and coarse public response schemas. Add exact tracking route when task 4 supplies request authorization.

- [ ] Write failing real-PostGIS cases for coordinate order/metres, Wolfram fixtures near 48.801925 and 108.448723 metres with tolerance, radius and service-area bounds, fresh/verified/available filters, NaN/infinity, stale/future/inaccurate/out-of-order fixes, cursor tampering and public-coordinate redaction. Validate the configured development rectangle and fail closed for missing production service-area configuration.
- [ ] Run focused cases to confirm failure before implementation.
- [ ] Implement the indexed geography model/upsert/query, shared validation and authenticated deterministic GPS simulator. Use bounded searches and stable coarse areas/distance bands; keep the exact private column out of public response schemas.
- [ ] Run focused cases and actual query-plan inspection with synthetic fixtures; test concurrent offline/update and suspension/update paths.
- [ ] Commit and push the verified location/discovery change.

## Task 4 Visit lifecycle expiry history and arrival

**Files:** Create `backend/app/models/visits.py`, `backend/app/models/reports.py`, `backend/app/visits/{schemas,service,router,state}.py`, migration `0004_visits_and_reports.py`, tests `test_visits.py`, `test_visit_concurrency.py`, `test_arrival.py`, `test_retention.py`; extend tracking authorization, admin report routes and `backend/app/jobs.py`.

**Interfaces:** `transition_visit(session, actor, visit_id, action, expected_version) -> VisitResponse`; `create_visit(session, customer, payload, idempotency_key) -> VisitResponse`; `expire_visits(session, now) -> int`; `evaluate_arrival(session, fix, candidate_store) -> events`. States and allowed actors exactly follow `docs/API.md`.

- [ ] Write failing tests for creation replay/payload mismatch, one active pair, expected-version conflicts, participant isolation, all allowed/rejected transitions, 5-minute pending/60-minute accepted deadlines and two-fix arrival rules.
- [ ] Run those cases and confirm failure. Concurrency tests use two real database transactions, not sequential mocked calls.
- [ ] Implement locking/version checks, event history and deadlines; authorize tracking only in accepted/approaching/arrived state. Add participant report submission and audited admin report handling with foreign keys to the now-created visit records. Add bounded cleanup respecting 24-hour point redaction and 90-day minimal history. Append notification rows after task 6 enables that table.
- [ ] Re-run transition/concurrency/privacy/arrival/retention cases, including a failed transaction and terminal-event duplicate attempt; verify no sale is inferred from completion.
- [ ] Commit and push the verified visit workflow.

## Task 5 Authenticated realtime delivery

**Files:** Create `backend/app/realtime/{schemas,manager,router}.py`, tests `test_websocket_auth.py`, `test_websocket_events.py`; compose manager/lifespan into the app.

**Interfaces:** `publish_event(event) -> None`; connection authenticates using the bounded initial auth frame, subscribes by authorized request ID, and receives versioned events. Durable REST remains the state authority.

- [ ] Write failing cases for unauthenticated/expired/revoked sessions, oversized auth/messages, unauthorized request subscriptions, terminal-state precise-location revocation, slow clients and reconnect resynchronization.
- [ ] Run WebSocket tests and confirm missing behavior fails.
- [ ] Implement bounded connection queues, heartbeats, expiry/revocation checks and committed-event fanout. Use short sessions and offload synchronous database work from async handlers. Do not add Redis or several API workers.
- [ ] Run realtime plus visit/privacy cases and a scripted two-client isolation check.
- [ ] Commit and push the verified realtime change.

## Task 6 Devices durable notifications and receipts

**Files:** Create `backend/app/models/notifications.py`, `backend/app/notifications/{schemas,provider,service,router,dispatcher}.py`, migration `0005_notifications.py`, tests `test_devices.py`, `test_outbox.py`, `test_notification_receipts.py`; extend transaction services and jobs.

**Interfaces:** `enqueue_for_event(session, event) -> None` participates in the business transaction; `dispatch_batch(session_factory, provider, now) -> DispatchResult` calls external delivery outside the business transaction; `ExpoProvider.send` and `receipts` accept typed transport payloads. Disabled configuration is reported honestly.

- [ ] Write failing tests for rollback/no-job separation, event/device/channel uniqueness, ownership transfer, invalid tokens, lease recovery, obsolete event suppression, provider timeout/retry and receipt errors.
- [ ] Run focused cases and confirm failure before code.
- [ ] Implement protected device upsert/deactivation, outbox constraints/leases, bounded backoff, ticket/receipt polling, invalid-token retirement and permission/ownership rechecks. Include outbox writes in the same transaction as visits/events.
- [ ] Run all backend tests, fresh migration chain/schema comparison and database/provider failure/recovery checks. Record actual provider/device delivery separately when credentials are configured.
- [ ] Commit and push the verified notification integration.

## Backend package acceptance

- [ ] Existing health tests still pass.
- [ ] Real PostGIS migration, auth, ownership, concurrency, privacy, expiry, arrival, notification and socket suites pass.
- [ ] Document endpoints match generated OpenAPI and actual event payloads.
- [ ] Synthetic customer/vendor/admin end-to-end script completes a visit and verifies unauthorized tracking denial.
- [ ] Every coherent checkpoint has been committed and pushed successfully.
