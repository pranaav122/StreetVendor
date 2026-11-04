# MyStreetVendor

A local MVP for finding verified street vendors and coordinating visits. Customers and partners use separate Expo applications. Staff review businesses and reports in a Next.js dashboard. FastAPI owns authorization and business rules; PostgreSQL/PostGIS stores the data.

The full remaining MVP was approved on 2 November 2026. Application code and a self-hosted deployment package are implemented. Local verification and external release gates are recorded separately in [LOCAL_VERIFICATION.md](docs/LOCAL_VERIFICATION.md). This repository has not been publicly deployed or submitted to app stores.

## Start reading

- [Workflow research and module explanations](docs/UX_RESEARCH_AND_CODE_MAP.md): reference apps, reasons, code owners and checks for the proposed simpler interface.

- [Project handbook](docs/PROJECT_HANDBOOK.md): a guided explanation of everything built, with exercises and debugging examples.
- [Architecture](docs/ARCHITECTURE.md), [database](docs/DATABASE.md), [API](docs/API.md) and [every-file guide](docs/FILE_GUIDE.md).
- [Windows setup](docs/DEPLOYMENT.md), [debugging](docs/DEBUGGING.md), [production package](docs/PRODUCTION.md) and [backup/restore](docs/BACKUPS.md).
- [Security](docs/SECURITY.md), [dependency alerts](docs/DEPENDENCIES.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md).

The [October foundation handbook](docs/FOUNDATION_HANDBOOK.md) and [October verification](docs/VERIFICATION.md) describe their original milestone. They do not describe today's complete application.

## Run locally in PowerShell

Use Docker Desktop with Linux containers, Python 3.13 and Node 24.13 or newer within Node 24. See the setup guide for fresh-environment instructions. Keep an existing `.env`; when creating one, copy `.env.example` and replace both secret placeholders with independent random values.

```powershell
Set-Location 'C:\Users\prana\Desktop\mystreetvendor'
$taskDockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path -LiteralPath $taskDockerBin) { $env:PATH = "$taskDockerBin;$env:PATH" }
docker compose --env-file .env -f infrastructure/compose.yaml build api
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait db mail
docker compose --env-file .env -f infrastructure/compose.yaml run --rm api alembic -c alembic.ini upgrade head
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait api
docker compose --env-file .env -f infrastructure/compose.yaml exec api python -m app.cli seed-categories
Invoke-RestMethod http://127.0.0.1:8000/health
npm ci
npm run web --workspace @mystreetvendor/customer-app
```

In separate PowerShell windows:

```powershell
npm run web --workspace @mystreetvendor/vendor-app
npm run dev --workspace @mystreetvendor/admin-dashboard
```

Open Customer on [8081](http://127.0.0.1:8081), Partner on [8082](http://127.0.0.1:8082), Staff on [3000](http://127.0.0.1:3000), API documentation on [8000/docs](http://127.0.0.1:8000/docs), and the development mail inbox on [8025](http://127.0.0.1:8025). Register customer/vendor accounts in their respective apps. Create your own staff account interactively:

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml exec api python -m app.cli create-admin --email 'YOUR_EMAIL'
```

The command prompts for a password. There is no shared default staff login. Browser previews keep mobile sessions in memory, so reloading signs them out. No database credential belongs in either application.

## Check what works

```powershell
./infrastructure/scripts/Test-Stack.ps1 -Browser -Production -NativeBundles
./.venv/Scripts/python.exe backend/scripts/demo_workflow.py
```

The full command includes actual PostgreSQL integration, application checks, browser journeys, isolated production containers and a restore drill. Native exports are JavaScript bundles; signed builds and real-device behavior require separate checks. The [verification record](docs/LOCAL_VERIFICATION.md) states actual results, including failures that led to fixes.

## Release boundary

The production package has private database/API/admin networking, separate database roles, Caddy routing and binary-safe backups. Public DNS/TLS/server access, approved pilot area, mail/push credentials, signing and physical-device tests remain release gates. Five moderate dependency alerts remain in Expo build tooling. Partner background-only sharing lasts at most the remaining 600-second access-token lifetime; shift-long unattended tracking is not promised.

Payments, inventory, sales accounting, route optimization and multi-city operations are future product work. A completed visit records workflow completion, not a sale.
