# Debugging independently

Use synthetic local accounts. Start with a failing layer and expected result. Keep private configuration, tokens, exact points and dumps out of logs/reports. Actual verification is in [LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md).

## Tools and containers

```powershell
$taskDockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path -LiteralPath $taskDockerBin) { $env:PATH = "$taskDockerBin;$env:PATH" }
docker version
docker compose --env-file .env -f infrastructure/compose.yaml config --quiet
docker compose --env-file .env -f infrastructure/compose.yaml ps
docker compose --env-file .env -f infrastructure/compose.yaml logs --tail 60 api db
```

Missing executable means PATH/install; missing Server response means Docker Desktop/Linux engine. An unhealthy container requires its service log. Plain resolved Compose output can print secrets; use `config --quiet`. Production logs omit raw request queries/bodies; keep that boundary.

## API and database

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
docker compose --env-file .env -f infrastructure/compose.yaml exec api alembic -c alembic.ini current
docker compose --env-file .env -f infrastructure/compose.yaml exec db psql -U mystreetvendor -d mystreetvendor -c 'SELECT PostGIS_Version()'
```

Use configured account/database names if different. Health 200 establishes database/PostGIS access, not every workflow. Health 503 distinguishes database/extension unavailability safely. Business database failures include a server request ID.

Containers use `db`; Windows Python uses the loopback port. Changing only `.env` does not rotate an existing cluster password. Use deliberate rotation and a verified backup. Deleting a volume is not a repair procedure.

## Confirm running code and set breakpoints

Backend source is copied into the image, without a source bind mount. Restarting an old image keeps old code. After an edit:

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml build api
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait api
```

Apply new migrations explicitly. A model edit does not change tables. To debug host Python, stop the container API first to free port 8000:

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml stop api
Push-Location backend
try { ../.venv/Scripts/python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --env-file ../.env --no-access-log }
finally { Pop-Location }
```

Configure your editor's Python debugger with that module, arguments and working directory. Break at the route, service and database call. Pausing may cause socket expiry/browser timeouts. An IDE breakpoint session has not been claimed as automated verification. Stop host Uvicorn before restarting the container API.

## Read HTTP outcomes

| Status | Next step |
|---|---|
| 401 | Check live session/account and expiry; sign in again where appropriate. |
| 403 | Check fixed role, verification, production email rules or staff Origin. |
| 404 | Check ID/ownership; private resources avoid revealing another user's record. |
| 409 | Refetch current version/state and allowed actions/tracking eligibility. |
| 422 | Read safe field/code errors; check timestamp, accuracy, area and unknown fields. |
| 429 | Respect the abuse window/Retry-After; avoid repeated retries. |
| 503 | Check database/provider/configuration; production staff requires private proxy identity. |

A stale version is a normal concurrency outcome. Retry creation with its existing idempotency key; do not generate a new key for every timeout. A 503 does not authorize blindly repeating a mutation.

## Discovery and sharing

Check active account, partner approval, availability/consent, recent usable fix, area, category and coarse radius. Discovery uses coarse regions, so it does not promise precise distances. A stale point is hidden even when availability is true; maintenance removes the stored point.

Tracking also requires that visit's customer and qualifying live state. Completion/cancellation/expiry ends tracking. Arrival needs two usable observations plus server timing/distance checks. Use [LOCATION.md](LOCATION.md), [VISITS.md](VISITS.md) and synthetic tests rather than weakening privacy checks.

## Browser, device and provider

Mobile browser sessions are in memory. Native builds need reachable networking, SecureStore, OS permissions and correct project IDs. Browser GPS tests do not prove native background behavior. Partner headless sharing ends by access-token expiry; foreground resume reconciles state.

Mailpit shows local capture; production needs real encrypted SMTP and sender verification. Expo needs independent projects and explicit notification permission. Tickets mean provider acceptance, while receipts and physical delivery are additional stages. Do not expose provider tokens in issues/logs.

## Focused tests

```powershell
$env:RUN_DB_TESTS = '1'
./.venv/Scripts/python.exe -m pytest -c backend/pyproject.toml backend/tests/test_retention.py -q
./.venv/Scripts/python.exe backend/scripts/demo_workflow.py
npm run test:client
npm run test:admin
./scripts/Test-Applications.ps1 tests/e2e/customer-partner.test.ts
```

The browser wrapper uses generated `msv_ui_*` databases/API port 8001 and rejects the real development database. Cases reset their own synthetic rows. Traces/video are disabled because login traffic has credentials.

`_env_file=None` disables file loading, not environment variables; production unit fixtures explicitly supply their mail settings. Windows backup tests skip explicitly in Linux because the image lacks PowerShell/host scripts; they run on Windows instead.

## Recovery

Use [BACKUPS.md](BACKUPS.md). Restore validates its archive, creates only a new generated isolated database, queries actual schema/records and removes its target on failure. Do not pipe dump bytes through PowerShell text processing or restore over development/pilot data.

`./infrastructure/scripts/Test-Production.ps1 -CheckBackup` checks private synthetic containers, actual roles, real Caddy routing/header handling, restarts and restore. It uses HTTP without public ports or certificates. Review the [release gates](ROADMAP.md) before treating that as a public deployment.
