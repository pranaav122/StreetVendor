# Current implementation status

The user approved completing the MVP on 2 November 2026. This file describes current code; the October architecture/handbook/verification documents retain their original milestone context.

## Implemented slices

- Foundation: Docker Compose, FastAPI, PostgreSQL/PostGIS, SQLAlchemy, explicit Alembic migrations and health checks.
- Core authentication: customer/vendor registration, Argon2id password hashes, access JWTs, hashed rotating refresh tokens, reuse detection, immediate logout/suspension revocation and PostgreSQL rate limits.
- Own account: profile updates, guarded role/identity fields, recent-login checks, deletion/anonymization and session revocation.
- Recovery: hashed single-use password-reset/email-verification links, encrypted production SMTP checks, local Mailpit inbox and interactive operator creation.
- Vendors: bilingual catalogue and idempotent seed command, own business profiles, staff review queue, audited approval/suspension, consent-based availability with first-fix validation, and exact-point erasure on offline/suspension/deletion.
- Location: monotonic latest-fix updates, freshness/accuracy/service-area checks, coarse discovery with actor-bound cursors and search limits, and a protected synthetic GPS simulator with cleanup.
- Comments explain the reasons for sensitive validation, locking, transaction commits, token hashes and cleanup.

## Latest executed checks

- Fresh foundation database baseline: 3 passed against real PostgreSQL/PostGIS.
- Initial account test cycle: 14 tests failed before the missing routes were implemented, then passed with the existing suite.
- Logout/refresh race reproduced as an incorrectly valid access token after logout; account-first locking fixed it and its regression test passed.
- Public template signing key was rejected after a failing regression test.
- Password-policy checks exposed silent whitespace stripping; explicit label normalization now preserves passwords and enforces the documented 15-character minimum.
- Location suite on Windows: **93 passed in 210.38 seconds**, followed by **3 passing cursor/abuse cases in 19.27 seconds**, including two additional checks.
- Full current suite in the Linux API image: **95 passed in 126.10 seconds**.
- Fresh upgrade/downgrade/re-upgrade and Alembic schema comparison passed through `0004_vendors_locations` in disposable databases.
- `scripts/Test-LocalMail.ps1` passed with actual SMTP capture in Mailpit, token consumption, new-password login and synthetic-account deletion. This proves local delivery only.
- Both location-update/offline and location-update/suspension races passed using actual PostgreSQL row locks. The synthetic planner test used the GiST bitmap index, and PostGIS distances matched the independent WGS84 fixtures within 2 centimetres.

## Still in progress

Visit lifecycle and authorized exact tracking; realtime; notifications; both independent mobile apps; admin dashboard; production configuration, backups/restore and final security review.

No current result proves public deployment, native background GPS, real push delivery or store release. Local development choices remain usable while real owner/provider inputs are pending.
