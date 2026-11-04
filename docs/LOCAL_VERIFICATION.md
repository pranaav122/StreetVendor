# Local verification — 4 November 2026

This records the complete MVP checks. [VERIFICATION.md](VERIFICATION.md) is the historical Phase 1 evidence from October; its limits describe that earlier milestone.

## Repeat the checks

From the repository in PowerShell, with Docker Desktop running and the documented `.env`, Python environment and npm dependencies installed:

```powershell
./infrastructure/scripts/Test-Stack.ps1 -Browser -Production -NativeBundles
```

The script rebuilds the development API, applies migrations, checks readiness, runs backend/database/container tests, application policy tests, strict type checks, the admin production build and both Expo dependency checks. The switches add browser journeys, disposable production containers including a backup/restore drill, and Android/iOS/web JavaScript exports. Exporting JavaScript does not build a signed phone installation.

It uses generated disposable databases for integration cases. Development database migrations are explicit; the development volume is retained. Production probes clean up only their generated Compose project and volume. Generated exports and logs stay ignored by Git.

For a short synthetic customer-to-partner visit through the HTTP handlers and real isolated PostgreSQL:

```powershell
./.venv/Scripts/python.exe backend/scripts/demo_workflow.py
```

This reuses the maintained end-to-end assertions rather than maintaining a second version of the business workflow. Notifications in that test use a simulated provider. It creates no demonstration accounts in the development database.

## Observed baseline before security fixes

The full command reached its final success message on 4 November:

| Check | Observed result |
|---|---|
| Backend, database, container and restore suite | 203 passed in 584.95 seconds |
| Shared client/customer/partner/admin policy suites | 22 / 6 / 24 / 12 passed |
| Contrast and touch-size assertions | Seven text contrast pairs and minimum touch dimensions passed |
| Shared and all three application strict type checks | Passed |
| Next.js production build | Passed |
| Customer and Partner Expo Doctor | 20/20 each |
| Customer and Partner Android/iOS/web JavaScript exports | Completed |
| Combined application browser journeys | 32 passed in 12.2 minutes |
| Disposable production package | Runtime privilege denials, HTTP handlers, admin cookie/forwarding, safe logs and restart checks passed |
| Production backup/restore drill | Restored and queried PostGIS, migration revision and representative records; removed only its isolated restore target |
| Separate demo entry point | 1 passed in 6.61 seconds |

The production probe runs inside local containers. Public DNS/TLS, a real server, signed installations, physical-device background behavior, real Expo delivery and real SMTP delivery are separate release gates. This baseline predates the security follow-up; later entries must identify the changed checks rather than imply the baseline covered future code.

## Windows operator checks in Linux

Running the new backup guard module inside the Linux API image initially produced seven failures: that image intentionally has neither host PowerShell nor the infrastructure scripts. The module now explicitly skips on non-Windows hosts. Rechecking produced **7 passed on Windows in 6.42 seconds**, including real Docker archive/cleanup checks, and **7 explicitly skipped in Linux**. This changes test selection, not production behavior or backup safeguards.

## Abandoned GPS cleanup

The security scan identified that stale coordinates were hidden from readers but remained stored after a phone disconnected. A real database regression first failed because a 91-second-old point remained present. The maintenance loop now physically deletes bounded batches older than the 90-second freshness window. It takes the same vendor lock as location writers, skips busy vendors, and rechecks freshness at deletion. This transaction follows the other cleanup transactions so it cannot reverse their lock order. A committed deletion sends an ID-only refresh hint; sharing consent itself stays unchanged.

The retention, notification-retention and location suites passed **27 tests in 62.43 seconds**. They include fresh-point preservation, stale-point erasure, bounded cleanup and a concurrent writer. The cleanup depends on the maintenance worker running; an outage or backlog delays physical erasure, while read-time freshness checks remain enforced. Backups made before deletion have their own retention and access policy.

## Admin login identity through the private proxies

Two new admin tests first failed because login requests had no client forwarding address and production accepted a missing private ingress identity. A Compose regression also failed because the admin proxy had no reserved address. After the change, **14 admin policy tests**, strict admin TypeScript and **20 production configuration checks** passed. Formatting checks passed for both changed TypeScript files.

`Test-Production.ps1 -CheckBackup` rebuilt both Linux production images and passed with the actual Caddyfile over private HTTP. Thirty failed attempts from one simulated ingress IP remained limited (the 31st returned 429); valid login from a different IP returned 200. Missing trusted identity returned 503. A request through Caddy with both forwarding headers forged to the blocked IP still logged in successfully, demonstrating their overwrite. The runtime role again failed all six privileged operations; API/database recovery and admin restart sign-out passed. The dump restored PostGIS, revision `0006_notifications`, two synthetic users and four categories, then removed its isolated target. All generated containers, networks and volumes were removed. No public listener, certificate or provider delivery was involved.

The trusted IP list contains only Caddy and Node's reserved addresses. Dynamic addresses use a separate portion of the private subnet so API startup cannot consume those reservations. These guarantees rely on keeping Node and the API unpublished and allowing only trusted containers onto that network.

## Cross-platform configuration fixture

After the security changes, the complete Windows backend run passed **207 tests in 449.37 seconds**. The first Linux run produced **194 passed, 11 skipped, 2 failed in 350.37 seconds**. Both failures came from the production unit-test constructor inheriting the development container's `SMTP_STARTTLS=false` environment. A new regression reproduced that inheritance with a deliberately conflicting mail environment. The helper now explicitly supplies its synthetic production mail values; no application guard was weakened. All **18 production configuration cases passed on Windows (0.17 seconds) and Linux (0.28 seconds)**. The eleven Linux skips cover Windows/Docker-host operator checks exercised separately on Windows. A complete Linux rerun follows this repair.

## Final local follow-up

After repairing the environment-dependent fixture, the rebuilt Linux development image passed **197 tests, 11 explicitly skipped in 217.48 seconds**. The skips are the seven Windows operator cases, the Windows binary roundtrip and three host Docker-configuration checks; those checks passed on Windows. The rebuilt development API returned health/database/PostGIS `ok`.

The current Next production build then passed and all **32 combined browser cases passed in 5.1 minutes**, using both Expo web apps, compiled Next, a real isolated API/database and local Mailpit. The generated browser database was removed. This includes the two-interface/browser-GPS visit, offline/error controls, session revocation, narrow Tamil layouts, recovery and staff flows. It does not add physical native or public-provider proof.

## Final review: sustained GPS allowance

The independent whole-project reviewer found that a five-second feed could need 180 PUTs per 15 minutes while the server allowed only 120. A real HTTP/PostgreSQL regression, with the limiter clock held in one bucket, failed on attempt 121 with 429. The server now permits 240 per vendor/window, retaining a finite allowance with margin for normal timing/retries. The regression accepts 240 fresh writes then requires 429 on attempt 241. The location/retention suites passed **25 tests in 48.61 seconds**, and the changed router passed Ruff. Sensor cadence, GPS validation and privacy guards were preserved.

## Final review: resume visibility and generation

The reviewer reproduced `ONLINE` while a delayed permission check was unresolved. Four new regressions failed before the change. Resume now pauses synchronously before any permission/network await, stopping callbacks and invalidating late uploads. It rechecks permission/account state, waits for canceled writes and requests a new first fix only when the same generation was previously sharing. Explicit offline/STOPPING and newer consent remain authoritative; failed fresh GPS attempts server erasure. Partner now passes **29 policy tests**, shared client **22**, and Partner strict TypeScript. Native scheduling itself remains unverified.

The one final independent review reported no Critical findings, two Important findings (GPS budget and resume visibility, now fixed with regressions), and one deferred Minor: eligibility and coordinates are read in separate tracking queries. Concurrent point deletion can therefore produce a safe 503/socket reconnect instead of `TRACKING_UNAVAILABLE`. No unauthorized point was demonstrated; the reviewer validated source/control flow, not a fresh real-PostGIS race. Combining those reads is deferred follow-up, with transient retry/resynchronization as the current practical limit. There is no second reviewer cycle; the complete post-fix suite is the final gate.

## Final post-review gate — passed

The complete command `./infrastructure/scripts/Test-Stack.ps1 -Browser -Production -NativeBundles` exited **0** after the fixes, with its final success message. A separate complete Linux run also exited **0**.

| Final check | Actual result |
|---|---|
| Windows backend, real database/container/backup tests enabled | **209 passed in 419.38 seconds** |
| Rebuilt Linux backend | **198 passed, 11 explicitly skipped in 339.52 seconds**; host-only cases covered on Windows |
| Client / Customer / Partner / Staff policy suites | **22 / 6 / 29 / 14 passed**, no skips |
| Shared and all app strict TypeScript | Passed |
| Text contrast / touch dimensions | All seven pairs and minimum dimensions passed |
| Next production build | Passed |
| Expo dependency alignment and Doctor | Both aligned; **20/20 each** |
| Android, iOS and web JavaScript exports | Completed for both independent apps; not signed builds |
| Current compiled-dashboard/Expo browser journeys | **32 passed in 4.7 minutes**; isolated database removed |
| Production Linux images, runtime authority and proxy | Built; six privilege denials, runtime HTTP, secure staff protocol, separate client limits and forged-header overwrite passed |
| Request log privacy / PostgreSQL recovery / staff restart | Passed; old staff cookie required sign-in |
| Production binary dump / isolated restore | PostGIS and revision `0006_notifications`, two synthetic users and four categories queried; target removed |
| Cleanup / development readiness | Generated production containers/networks/volumes removed; zero disposable test databases remained; development health/database/PostGIS `ok` |
| Documentation | 399 local links exist, all 312 files mapped, 44 REST operations indexed; diff whitespace checks passed |

The final reviewed source fixes are `f283e70` (bounded GPS allowance) and `950ebdb` (pause before resume validation), after the earlier sealed-scan fixes. No critical or important review finding remains unaddressed in this pass. One Minor and the external/dependency/privacy release gates remain explicitly documented. This is local software verification, not a public release or exhaustive proof of security.
