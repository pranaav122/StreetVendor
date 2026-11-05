# Local verification

## Approved simple UI — final post-review result, 5 November 2026

The approved Customer and Vendor layouts are implemented with the existing colours and dependencies. Vendor Home prioritises availability and the next customer; Customers separates New / Active / Past; My shop explains approval; optional controls and troubleshooting stay available through named disclosures. Customer discovery promotes a public meeting label and optional GPS, retains manual coordinates, and shows committed visit progress. Persistent labelled navigation has local monochrome icons. Necessary comments explain responsibilities, privacy, stale results and transaction/cleanup decisions; ordinary statements retain descriptive names.

The final independent static review found three P2 specification gaps, all corrected in one fix pass. Before implementation, the six added browser cases failed: five exposed missing UI; the sixth revealed that its suspension fixture used the verification endpoint incorrectly. The fixture now uses the dedicated suspension endpoint. All six cases passed in the final full run. The older staff sign-out test now waits for the actual DELETE 204 response before checking session 401; application sign-out code was unchanged.

**Final actual results:** the complete application browser suite passed **40/40 in 6.4 minutes**, against the real isolated PostgreSQL/API harness; the generated database was removed. All four policy suites passed **23 / 6 / 29 / 14** (72 total); shared and all app strict TypeScript passed; seven contrast pairs passed. After review fixes, Vendor's 29 policy tests, strict types and Android/iOS/web exports passed again. Customer's unchanged post-checkpoint exports had already passed all three platforms. Exports use a placeholder HTTPS API and prove compilation only. Normal and doubled-text Tamil screenshots were visually inspected for both apps.

The every-file inventory maps all **325 maintained files**. R1–R11 reasons, source ownership, evidence and device/pilot limits are in UX_RESEARCH_AND_CODE_MAP.md. No API contracts, backend state transitions, provider integrations or new dependencies were added by the final UI pass. Backend/production verification below is historical, not a new full backend rerun.

The two development previews were restored with the Wi-Fi API address. Both page roots returned HTTP 200 from this computer; API/database/PostGIS health returned ok, and the vendor Wi-Fi origin passed CORS preflight. Physical iPhone access is not confirmed. LAN HTTP previews do not prove iPhone GPS, secure random request creation, native background execution, maps handoff, notifications, VoiceOver or native font scaling; use a secure preview/native build for those checks. No real-user usability pilot or new Figma file is claimed.

## Navigation finish and integrated checks — 5 November 2026

Both apps now use original local monochrome destination pictograms alongside visible translated labels. Colours are unchanged; no runtime dependencies were added. Customer and Vendor doubled-text Tamil screenshots were inspected after the browser bounds checks passed.

All policy suites passed: **23 client, 6 customer, 29 vendor, 14 staff**. Shared and all three app strict TypeScript checks passed; all seven contrast pairs passed. Both apps completed **Android, iOS and web JavaScript exports** using a placeholder HTTPS API URL; these are compilation checks, not signed builds or device/provider tests. All 324 maintained files were mapped and 329 local documentation links existed.

The first complete browser run passed **33/34 in 7.1 minutes**. The staff sign-out assertion ran after local UI cleanup but before its asynchronous DELETE response, returning 200. This test must wait for the committed sign-out response before checking revocation; the failure is recorded, not counted as a pass. Final review also identified three specification gaps: vendor New/Active/Past groups, approval guidance on My shop and arrival troubleshooting in visit help. Their regression/fix pass is pending. Historical full-MVP checks below remain separate.

## Customer workflow checkpoint — 5 November 2026

Customer discovery now starts with a public meeting label and optional GPS; manual coordinates remain under Enter coordinates. Categories appear after selection. Visit screens explain committed progress and group detailed coordinates, cancellation and reporting behind named controls. Account deletion and notifications are optional sections; their confirmations remain unchanged. No place-search provider, fake results or dependencies were added.

The updated manual-entry journey failed on the old screen before implementation (1 failed, 2 passed). The corrected customer/auth/visits/freshness/Tamil/cross-app/navigation run passed **10/10 in 2.5 minutes**, using the isolated API and real PostgreSQL database; the generated database was removed. Customer/client unit suites passed **6/23**, and Customer strict TypeScript passed. The Tamil 390-pixel screenshot was inspected: wrapped controls and persistent navigation were visible without horizontal overflow. Device font scaling and VoiceOver remain separate checks.

Full integrated verification and native exports remain pending for this UI change. Historical backend/production results below are not reruns for this checkpoint.

## Vendor workflow checkpoint — 5 November 2026

Vendor Home now prioritises availability and recent active visits; background settings and statistics are disclosures. First-time vendors get a large setup action. Visits reveal decline/cancellation reasons and reports only when requested; map coordinates are secondary to directions. Profile and sign-in copy is simpler. Account deletion and optional notifications remain available behind named controls. The API still owns approval, allowed actions, versions and arrival.

Regression evidence: the first 15-case vendor/cross-app run passed 14 cases and exposed one outdated shared notification hint. After its correction, account/Tamil checks passed 3/3 (48.1 seconds). First-time setup was watched fail before the new button; the corrected setup/location/customer-auth run passed 7/7 (1.1 minutes). The shared unavailable-notification test was also watched fail before its app-specific destination fix. Final unit counts: client 23, customer 6, partner 29, all passed. Shared and both app strict type checks passed; seven contrast pairs passed.

Visual inspection then exposed overlapping Tamil navigation labels despite the older page-width assertion passing. A stronger label-boundary regression was watched fail, then corrected by constraining centred labels in both apps. The final navigation/Tamil run passed 3/3 in 43.0 seconds, including doubled rendered text sizes. Normal and enlarged screenshots were visually inspected. This is a browser text-size stress check, not an iPhone screen-reader or native font-scale test. Seventeen replaced translation entries were removed only after checking for remaining vendor-source references; translations were retested.

Customer screen simplification and full integrated/native export checks are still pending. These scoped results do not replace the historical full-MVP checks below.

## Mobile navigation checkpoint — 5 November 2026

Both apps now keep labelled navigation outside scrolling screen content, identify the selected destination and respect safe areas. Vendor destinations are Home, Customers, My shop and More; Customer destinations are Nearby, Your visits and Account. Colours are unchanged. Daily screen simplification is still in progress under the approved root DESIGN.md.

The new `mobile-navigation.test.ts` cases first failed against the old layout because the navigation landmark was absent. The first implementation exposed dropped Pressable styles through Expo Router's slot and missing browser selection attributes; those were corrected from installed framework-source evidence. Final targeted run:

```powershell
./scripts/Test-Applications.ps1 tests/e2e/mobile-navigation.test.ts tests/e2e/partner-profile.test.ts tests/e2e/partner-account.test.ts tests/e2e/customer-auth.test.ts tests/e2e/partner-tamil.test.ts tests/e2e/customer-tamil.test.ts --reporter=line
```

Result: **10 passed in 2.0 minutes**, against a generated disposable PostgreSQL database, removed after the run. Customer and Partner strict type checks passed; Customer unit tests passed 6 and Partner passed 29. Seven text contrast pairs and minimum control dimensions passed. Full browser/backend suites and native exports are not new results for this checkpoint; physical-device and screen-reader checks remain unverified.

## Complete MVP baseline — 4 November 2026

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
