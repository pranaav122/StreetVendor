# MyStreetVendor

MyStreetVendor is a planned neighbourhood platform for discovering street vendors and requesting a visit. Two independent future applications, **MyStreetVendor Customer** and **MyStreetVendor Partner**, will share one trusted FastAPI backend. Phones will never connect directly to PostgreSQL.

## Scope

Phase 0 documents the whole system. Phase 1 builds only the backend foundation: FastAPI, PostgreSQL/PostGIS, Docker Compose, SQLAlchemy, Alembic, `/health`, and automated tests. Authentication and all mobile applications are future phases. See [the roadmap](docs/ROADMAP.md).

## Design documents

For a guided explanation of everything built so far, read the [foundation handbook](docs/FOUNDATION_HANDBOOK.md) or its [PDF edition](output/pdf/MyStreetVendor_Foundation_Handbook.pdf). It includes code walkthroughs, exercises, a glossary and an answer key before Phase 2.

- [Architecture and diagrams](docs/ARCHITECTURE.md)
- [Database design and ER diagram](docs/DATABASE.md)
- [REST and WebSocket contracts](docs/API.md)
- [Security and privacy](docs/SECURITY.md)
- [Local development and future deployment](docs/DEPLOYMENT.md)
- [Independent debugging guide](docs/DEBUGGING.md)
- [Roadmap and learning checkpoints](docs/ROADMAP.md)
- [Every file and the request-to-database walkthrough](docs/FILE_GUIDE.md)
- [Actual verification results and known limits](docs/VERIFICATION.md)

## Phase 1 setup

The Phase 1 foundation is implemented. Use **Windows PowerShell** from the repository root. Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md) for first-time environment setup, local Python operation and explanations. The local `.env` created during development contains a generated password and is ignored by Git. On a new checkout, copy `.env.example` to `.env` and replace its password first.

```powershell
Set-Location 'C:\Users\prana\Desktop\mystreetvendor'
# If Docker is not already on PATH, add its discovered per-user installation for this shell.
$taskDockerBin = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'
if (Test-Path -LiteralPath $taskDockerBin) { $env:PATH = "$taskDockerBin;$env:PATH" }
docker version
docker compose version
docker compose --env-file .env -f infrastructure/compose.yaml config --quiet
docker compose --env-file .env -f infrastructure/compose.yaml build
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait db
docker compose --env-file .env -f infrastructure/compose.yaml run --rm api alembic -c alembic.ini upgrade head
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait api
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health'
```

Open [the local Swagger UI](http://127.0.0.1:8000/docs) after startup. The only application route is `/health`; no authentication/business endpoints exist yet. The generated OpenAPI schema includes its 200 and 503 response models.

Run all automated tests inside Linux, including isolated database tests:

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml run --rm -e RUN_DB_TESTS=1 api python -m pytest
```

Without `RUN_DB_TESTS=1`, seven unit tests run and three database tests are skipped explicitly. The three integration tests create unique disposable databases and leave the development database intact. See [the actual results](docs/VERIFICATION.md), rather than treating expected output as evidence.

```powershell
# Inspect logs or stop the local stack while preserving its data.
docker compose --env-file .env -f infrastructure/compose.yaml logs --tail 100 api db
docker compose --env-file .env -f infrastructure/compose.yaml down
```

## Mobile applications

Neither mobile application exists yet. Phases 8 and 9 will create separate Expo projects after the supporting backend features are implemented and approved. There are no customer/vendor launch commands in this milestone.

## Selected foundation

Python 3.13; FastAPI and Pydantic 2; synchronous SQLAlchemy 2 with Psycopg 3; Alembic; PostgreSQL 18 with PostGIS 3.6; Uvicorn; Pytest and HTTPX2 for the current Starlette TestClient. Exact installed versions are pinned in `backend/pyproject.toml` and `backend/requirements.lock`. The [PostGIS image maintainers](https://github.com/postgis/docker-postgis) document the PostgreSQL 18 volume path `/var/lib/postgresql`.

Expo/React Native, strict TypeScript, Expo Router and TanStack Query are selected for the future mobile architecture. Their compatible versions will be selected with `expo install` against the stable Expo SDK when those phases begin. No mobile dependency workspace or mobile application is generated in Phase 1.
