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
- `scripts/Test-LocalMail.ps1` passed with actual SMTP capture in Mailpit, token consumption, new-password login and synthetic-account deletion. This proves local delivery only.
- Both location-update/offline and location-update/suspension races passed using actual PostgreSQL row locks. The synthetic planner test used the GiST bitmap index, and PostGIS distances matched the independent WGS84 fixtures within 2 centimetres.

## Still in progress

Device/push notifications; both independent mobile apps; admin dashboard; production configuration, backups/restore and final security review.

No current result proves public deployment, native background GPS, real push delivery or store release. Local development choices remain usable while real owner/provider inputs are pending.
