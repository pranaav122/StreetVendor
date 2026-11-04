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
