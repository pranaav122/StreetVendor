# Windows development and deployment

The local MVP and production package are implemented. This page starts local applications; [PRODUCTION.md](PRODUCTION.md) covers eventual server deployment and restricted roles. [BACKUPS.md](BACKUPS.md) covers backup/restore. No public server has been provisioned.

## Prerequisites

Use PowerShell, Docker Desktop with its Linux engine, Python 3.13 and Node 24 (at least 24.13).

```powershell
Set-Location 'C:\Users\prana\Desktop\mystreetvendor'
$taskDockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path -LiteralPath $taskDockerBin) { $env:PATH = "$taskDockerBin;$env:PATH" }
docker version
docker compose version
py -3.13 --version
node --version
npm --version
```

Docker's Server section must respond. The PATH adjustment lasts in this shell only; some installations use `C:\Program Files\Docker\Docker\resources\bin` instead.

## Private configuration

Do not overwrite an existing `.env`. On first setup:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
notepad .env
```

Replace database/signing placeholders with independent random values. For each, PowerShell can generate `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))`; paste privately into the file. Never commit it or use an Expo public variable for it. Initialization settings apply to a new database volume; editing the file does not rotate an existing database password.

Host configuration uses `POSTGRES_HOST=127.0.0.1`; Compose overrides it to `db` inside the API. Local mail goes to Mailpit. App `.env.example` files contain public settings; loopback defaults work without extra files. Use Staff's example for custom origins.

## Start services

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml config --quiet
docker compose --env-file .env -f infrastructure/compose.yaml build api
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait db mail
docker compose --env-file .env -f infrastructure/compose.yaml run --rm api alembic -c alembic.ini upgrade head
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait api
docker compose --env-file .env -f infrastructure/compose.yaml exec api python -m app.cli seed-categories
Invoke-RestMethod http://127.0.0.1:8000/health
```

Migrations are explicit. The volume preserves rows; the seed preserves retired categories. The API's [interactive documentation](http://127.0.0.1:8000/docs) contains current schemas.

## Python tools and applications

For a fresh environment, skip creation if `.venv` already exists:

```powershell
py -3.13 -m venv .venv
./.venv/Scripts/python.exe -m pip install -c backend/requirements.lock -e './backend[test]'
npm ci
npm run web --workspace @mystreetvendor/customer-app
```

In two other PowerShell windows:

```powershell
npm run web --workspace @mystreetvendor/vendor-app
npm run dev --workspace @mystreetvendor/admin-dashboard
```

| Interface | Default local address |
|---|---|
| Customer | http://127.0.0.1:8081 |
| Partner | http://127.0.0.1:8082 |
| Staff | http://127.0.0.1:3000 |
| API docs | http://127.0.0.1:8000/docs |
| Development inbox | http://127.0.0.1:8025 |
| PostgreSQL for host debugging | 127.0.0.1:5432 |

Register each app role through its own app. Create your own staff login interactively:

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml exec api python -m app.cli create-admin --email 'YOUR_EMAIL'
```

The partner submits a profile/review and staff approves it before sharing. Go online with a usable current fix. Browser mobile sessions are in memory; reload requires sign-in. Staff uses a separate server-cookie mechanism.

## Verify and stop

```powershell
./infrastructure/scripts/Test-Stack.ps1 -Browser -Production -NativeBundles
# Backend inside Linux:
docker compose --env-file .env -f infrastructure/compose.yaml run --rm -e RUN_DB_TESTS=1 api python -m pytest -q
# Stop while retaining data:
docker compose --env-file .env -f infrastructure/compose.yaml down
```

Linux explicitly skips Windows/Docker-host operator checks. Run the full PowerShell script on Windows for those. Integration fixtures use generated disposable databases. The five moderate Expo build-tool alerts are recorded in [DEPENDENCIES.md](DEPENDENCIES.md).

Native profiles exist, but EAS linking, signing, maps, store ownership, physical permissions/background behavior and push require actual owner/device evidence. A phone cannot reach this loopback API. Deliberate LAN binding/firewall/API-origin configuration is required for that exercise; keep PostgreSQL private. Web previews and JavaScript exports do not prove signed installations.
