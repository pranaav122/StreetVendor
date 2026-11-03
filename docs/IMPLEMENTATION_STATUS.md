# Current implementation status

The user approved completing the MVP on 2 November 2026. This file describes current code; the October architecture/handbook/verification documents retain their original milestone context.

## Implemented slices

- Foundation: Docker Compose, FastAPI, PostgreSQL/PostGIS, SQLAlchemy, explicit Alembic migrations and health checks.
- Core authentication: customer/vendor registration, Argon2id password hashes, access JWTs, hashed rotating refresh tokens, reuse detection, immediate logout/suspension revocation and PostgreSQL rate limits.
- Own account: profile updates, guarded role/identity fields, recent-login checks, deletion/anonymization and session revocation.
- Recovery: hashed single-use password-reset/email-verification links, encrypted production SMTP checks, local Mailpit inbox and interactive operator creation.
- Vendors: bilingual catalogue and idempotent seed command, own business profiles, staff review queue, audited approval/suspension, consent-based availability with first-fix validation, and exact-point erasure on offline/suspension/deletion.
- Location: monotonic latest-fix updates, freshness/accuracy/service-area checks, coarse discovery with actor-bound cursors and search limits, and a protected synthetic GPS simulator with cleanup.
- Visits: idempotent creation, one active pair, guarded transitions/versions, expiry, private tracking, server-confirmed two-fix arrival, participant reports, audited staff inspection/resolution/cancellation, account-deletion erasure and bounded maintenance.
- Staff recovery: audited return from business suspension to pending review, safe inactive-target handling, deleted-owner queue filtering, and role-protected operational/daily visit summaries.
- Realtime: authenticated bounded WebSockets, PostgreSQL commit hints, participant-only inbox/tracking, send-time live authorization, expiry/revocation/heartbeat checks and REST resynchronization after reconnect.
- Notifications: session-bound device ownership, transactional outbox, bounded leases/retries, project-separated Expo batches, guarded ticket/receipt processing and privacy cleanup. See [notification delivery](NOTIFICATIONS.md).
- Application foundation: independent Expo SDK 58 Customer/Partner projects, native SecureStore adapters, memory-only browser sessions, strict response/event contracts, coordinated refresh, bounded realtime transport and per-app session/query providers. Feature screens are still pending.
- Design: shared accessible tokens and documented bilingual screen states. The Figma draft has known clipping/spacing defects; Starter-plan tool quota blocked the corrective call. See [design handoff](DESIGN.md).
- Customer first feature slice: registration/sign-in/reset request, permission-aware/manual meeting-point choice, category-filtered discovery, profile/language preferences, confirmation-mail request, sign-out and guarded account deletion.
- Customer visits: vendor details, stable request-attempt idempotency, active/history lists, versioned cancellation, authorized fresh tracking, terminal tracking cleanup and participant reporting. Map/push/recovery-confirmation/translation integration remains in progress.
- Customer maps: optional coarse-area web/native map adapters, authorized tracking map, native Android configuration fallback, provider disclosure, safe popup text and cleanup. See [map setup](MOBILE_MAPS.md). Push/recovery-confirmation/translation integration remains in progress.
- Customer recovery: reset/email-confirmation pages, bounded fragment parsing, visible-URL scrubbing, explicit one-use-token confirmation, native cold/warm link listener and masked manual-link fallback. Native link dispatch still needs device verification. Push/translation integration remains in progress.
- Customer notification adapter: explicit opt-in, physical-build/project/permission checks, stable installation registration, native token refresh and guarded notification-tap navigation. Physical delivery remains unverified; Tamil copy integration remains in progress.
- Customer language: English/Tamil sign-in choice, registration/account preference, translated controls/headings/static copy/statuses and bilingual server categories. User-entered names/labels remain intact. Tamil wording still needs pilot-user review.
- Comments explain the reasons for sensitive validation, locking, transaction commits, token hashes and cleanup.

## Latest executed checks

- Fresh foundation database baseline: 3 passed against real PostgreSQL/PostGIS.
- Initial account test cycle: 14 tests failed before the missing routes were implemented, then passed with the existing suite.
- Logout/refresh race reproduced as an incorrectly valid access token after logout; account-first locking fixed it and its regression test passed.
- Public template signing key was rejected after a failing regression test.
- Password-policy checks exposed silent whitespace stripping; explicit label normalization now preserves passwords and enforces the documented 15-character minimum.
- Visit checkpoint on Windows: **124 passed in 461.79 seconds**. A subsequent worker-failure cleanup regression passed separately after reproducing skipped pool disposal.
- Same 124-case suite in the Linux API image: **124 passed in 377.92 seconds**. The final task check also includes the new shutdown regression.
- Final visit/migration/shutdown task check in Linux: **33 passed in 115.61 seconds** after formatting and the cleanup fix.
- Administration recovery follow-up: **21 passed in 93.66 seconds** on Windows and **21 passed in 39.76 seconds** in Linux, after five new cases failed before implementation.
- Realtime checkpoint: **17 relevant cases passed in 51.70 seconds** on Windows, including a real Uvicorn TCP server and two independent clients. Disconnect cancellation and queued delivery after unsubscribe were reproduced and fixed.
- Full Linux backend suite: **146 passed in 256.68 seconds**. A subsequent stronger GPS-frame version assertion failed first and then passed separately after adding the request version; the final checkpoint gate includes it.
- Fresh upgrade/downgrade/re-upgrade and Alembic schema comparison passed through `0005_visits_reports` in disposable databases.
- Notification checkpoint: **170 backend tests passed in 318.02 seconds** on Windows. Device/delivery/migration checks passed **27 cases in 52.43 seconds**; after reproducing disabled-provider receipt retention, the final retention subset passed **3 cases in 10.87 seconds**. Fresh migration/schema comparison includes `0006_notifications`.
- Postman CLI checked the running local `/health`: HTTP 200 with database and PostGIS `ok`, with one passing assertion. This checks the current local service, not public hosting.
- Final notification checkpoint gate: **28 passed in 58.32 seconds**. The built API applied `0006_notifications` to the development database, restarted healthy and returned database/PostGIS `ok`.
- `scripts/Test-VisitWorkflow.ps1`: **1 passed in 3.81 seconds**, covering registration/approval, availability, coarse discovery, visit creation, a fake-provider ticket, acceptance, private tracking, two-fix arrival, completion and outsider denial through HTTP handlers with real PostgreSQL. It does not exercise a mobile device or a public server.
- Application foundation: **16 shared-client tests passed**, strict TypeScript passed for shared packages and both apps, both web exports succeeded, and Expo Doctor passed **20/20 checks per app**. `expo install --check` reports compatible dependencies for each app.
- npm audit currently reports **11 moderate findings** through Expo's `glob`/`minimatch` build-tool dependency chain. These require dependency/security review; no force downgrade was applied and no claim of a clean dependency audit is made.
- Customer browser checks against the running local API: **3 passed in 14.3 seconds** (registration, denied-location manual search/sign-out, short-password validation and guarded deletion/revoked login). Shared client suite now has **17 passing tests**, including the reproduced browser fetch-receiver regression. A 390×844 preview was visually inspected for wrapping and spacing.
- HTTP origin integration: **9 focused backend checks passed**, followed by the synthetic visit workflow (**1 passed in 2.61 seconds**). The rebuilt local API is healthy with browser preflight support.
- Isolated browser runner: the same **3 browser cases passed in 15.7 seconds** using a fresh migrated/seeded database and a separate API on port 8001. Cleanup removed the generated database successfully. Development data was not used by that run.
- Customer visit checks: **2 browser cases passed in 25.0 seconds** against an isolated real API/database, covering request/accept/track/two-fix arrival/complete/report/history and guarded cancellation. **2 pure intent/freshness cases passed**. Shared and Customer strict TypeScript checks passed. The first workflow reached the missing detail route before implementation; its later history assertion was narrowed to visible content because the router retains hidden screens.
- Customer map checkpoint: **5 browser cases passed in 29.8 seconds**, including map removal at completion; a separate real-tile check passed **1 case in 12.6 seconds** and its loaded street-map image was visually inspected. Customer strict checking and web export passed. Native maps remain unverified.
- Customer recovery: **2 browser cases passed in 14.1 seconds** with actual local Mailpit SMTP capture, reset/revocation/new-password login and email confirmation; fragments were removed before submission. **4 Customer pure tests passed**, including link bounds/query rejection and intent/freshness checks. Shared and Customer strict TypeScript passed.
- Customer push adapter: **20 shared-client tests passed** and the browser unavailable-state flow passed **1 case in 13.7 seconds**. Shared/Customer strict checks passed. Native driver tests use deterministic stand-ins and do not prove real push delivery.
- Customer language checkpoint: **8 browser cases passed together in 42.9 seconds**, including Tamil registration and a 390-pixel layout check. The Tamil preview was visually inspected for wrapping. **20 client tests**, **5 Customer pure tests**, shared/Customer strict checking and web export passed. Native text scaling and pilot-user language review remain unrun.
- Customer lifecycle checkpoint: **21 client tests passed**, including pause/resume subscription preservation and sign-out erasure. **3 focused browser flows passed in 29.9 seconds**, covering real remote session revocation and both visit workflows after tracking-resynchronization changes. Shared/Customer strict checks passed. Native AppState callbacks are implemented but remain device-unverified.
- Discovery freshness: the browser regression reproduced an offline vendor remaining in a cached list. Automatic refresh and timestamp expiry fixed it; **1 focused browser case passed in 50.6 seconds**, and **6 Customer pure tests passed**. Shared/Customer strict checking passed. Expo Doctor passed **20/20 checks** for the current Customer setup.
- Customer acceptance checkpoint: **all 10 browser workflows passed together in 1.7 minutes** against an isolated migrated PostgreSQL database. Web, Android and iOS JavaScript exports succeeded, including Hermes bundles for both native platforms. These exports verify bundling, not a signed installation, operating-system permissions, background behavior or physical push delivery.
- Partner integration preparation: vendor logout/logout-all now erase the point and disable sharing atomically with revocation. Both privacy regressions failed before implementation; **38 focused backend cases passed in 42.57 seconds**, covering authentication, devices, location behavior and active-visit tracking erasure.
- `scripts/Test-LocalMail.ps1` passed with actual SMTP capture in Mailpit, token consumption, new-password login and synthetic-account deletion. This proves local delivery only.
- Both location-update/offline and location-update/suspension races passed using actual PostgreSQL row locks. The synthetic planner test used the GiST bitmap index, and PostGIS distances matched the independent WGS84 fixtures within 2 centimetres.

## Still in progress

Customer and Partner feature screens; admin dashboard; production configuration, backups/restore and final security review. Live push delivery remains a provider/device verification gate.

No current result proves public deployment, native background GPS, real push delivery or store release. Local development choices remain usable while real owner/provider inputs are pending.
