# Current implementation status

Updated 4 November 2026. Full remaining-project approval was given on 2 November. The local MVP, two independent Expo applications, Staff dashboard and self-hosted production/restore package are implemented and their final available checks passed. Independent review completed; its two Important issues were fixed and one Minor is deferred. Public/device/provider gates remain separate.

## Delivered

- FastAPI modular monolith, SQLAlchemy/Psycopg, PostgreSQL 18/PostGIS 3.6, six Alembic migrations and safe readiness/error logging.
- Fixed-role accounts, Argon2id, live session checks, rotating hashed refresh families, recovery, own account/deletion and interactive staff bootstrap.
- Bilingual categories, business profiles/review/audit, suspension/reinstatement, explicit sharing, latest GPS, coarse spatial discovery and customer-only eligible tracking.
- Versioned/idempotent visits, expiry, two-fix arrival, events, reports, history, summaries and privacy cleanup including physical stale-GPS removal.
- Bounded authenticated WebSockets and session-bound durable notification jobs, leases/retries/tickets/receipts with provider simulation evidence.
- Independent Customer/Partner screens, English/Tamil preferences, account/recovery, maps/navigation, notification adapters and foreground/resume guards. Partner has a native background adapter with explicitly bounded token lifetime.
- Next Staff UI with opaque browser cookies, server-held tokens, exact-Origin mutations, allowlisted proxy, live backend authority and audited controls.
- Restricted production database roles, private Caddy/API/Node networks, Linux images, safe logs, restart recovery, binary-safe backup and isolated restore.
- Current architecture/database/API/security/deployment/debugging guides and [project handbook](PROJECT_HANDBOOK.md), plus an [every-file map](FILE_GUIDE.md).

## Executed evidence

The detailed dates, commands, failures and follow-ups are in [LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md). Key checkpoints include:

- Final complete Windows backend: **209 passed in 419.38 seconds**. Rebuilt Linux image: **198 passed, 11 explicit host-only skips in 339.52 seconds**. Those skipped operator/Docker checks passed on Windows.
- Final client/customer/partner/admin policy suites: **22/6/29/14**; shared/all-app strict checks, contrast and Next build passed; both Expo Doctors **20/20** and both Android/iOS/web JavaScript exports completed. All **32 browser journeys passed in 4.7 minutes**.
- Actual production images/roles, six privilege denials, Caddy private routing/header overwrite, separate login-client limits, restart recovery and isolated restore passed.
- Codex Security completed its source scan with two confirmed findings. Both received focused failing regressions and later fixes; the sealed report remains a record of its earlier source revision. See [SECURITY.md](SECURITY.md).
- Python package consistency passed. Five moderate Expo build-tool dependency alerts remain open; see [DEPENDENCIES.md](DEPENDENCIES.md).

The complete `Test-Stack.ps1 -Browser -Production -NativeBundles` command exited successfully after both final review fixes; a separate full Linux run also passed. Production rehearsal repeated actual Caddy identity/rate-limit checks, all six privilege denials, safe logs, database/admin restarts and isolated restore. Generated databases/production containers were removed. Earlier failures and checkpoints remain in the detailed verification record. The October [verification](VERIFICATION.md) and [foundation handbook](FOUNDATION_HANDBOOK.md) retain their historical milestone context.

## Limits before public use

No public server/TLS, signed installation, real push delivery or physical-device background/resume/linking claim is made. Production needs owner resources and an approved service-area polygon. Partner headless-only sharing ends by the current access token's remaining 600-second lifetime. Dependency alerts, expired-refresh/audit retention, admin MFA/access policy, off-server backup scheduling/encryption, support/privacy ownership and native/provider checks remain release gates in [ROADMAP.md](ROADMAP.md).

One deferred Minor can return a temporary tracking dependency error/socket reconnect if a point disappears between two reads. It needs a retry/resynchronization; combining the reads with a controlled race regression remains follow-up. No unauthorized point was demonstrated. The independent review and this limitation are recorded in the verification record and handbook decision appendix.

The Figma draft contains known spacing/clipping defects and its corrective write was quota-blocked. Local running UI/tokens are the current reference. No additional paid resources were created.
