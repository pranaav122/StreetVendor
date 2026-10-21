# MyStreetVendor

MyStreetVendor is a planned neighbourhood platform for discovering street vendors and requesting a visit. Two independent future applications, **MyStreetVendor Customer** and **MyStreetVendor Partner**, will share one trusted FastAPI backend. Phones will never connect directly to PostgreSQL.

## Scope

Phase 0 documents the whole system. Phase 1 builds only the backend foundation: FastAPI, PostgreSQL/PostGIS, Docker Compose, SQLAlchemy, Alembic, `/health`, and automated tests. Authentication and all mobile applications are future phases. See [the roadmap](docs/ROADMAP.md).

## Design documents

- [Architecture and diagrams](docs/ARCHITECTURE.md)
- [Database design and ER diagram](docs/DATABASE.md)
- [REST and WebSocket contracts](docs/API.md)
- [Security and privacy](docs/SECURITY.md)
- [Local development and future deployment](docs/DEPLOYMENT.md)
- [Independent debugging guide](docs/DEBUGGING.md)
- [Roadmap and learning checkpoints](docs/ROADMAP.md)

## Phase 1 setup

The implementation will provide the following workflow from the repository root in **Windows PowerShell**. Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md) for prerequisites, environment setup, local Python operation and explanations. Commands and verification results will be finalized after the foundation is implemented and executed.

```powershell
Set-Location 'C:\Users\prana\Desktop\mystreetvendor'
# If Docker is not already on PATH, add its discovered per-user installation for this shell.
$taskDockerBin = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'
if (Test-Path -LiteralPath $taskDockerBin) { $env:PATH = "$taskDockerBin;$env:PATH" }
docker version
docker compose version
```

## Selected foundation

Python 3.13; FastAPI and Pydantic 2; synchronous SQLAlchemy 2 with Psycopg 3; Alembic; PostgreSQL 18 with PostGIS 3.6; Uvicorn; Pytest and HTTPX. Exact installed versions will be recorded with the implementation. The [PostGIS image maintainers](https://github.com/postgis/docker-postgis) document the PostgreSQL 18 volume path `/var/lib/postgresql`.

Expo/React Native, strict TypeScript, Expo Router and TanStack Query are selected for the future mobile architecture. Their compatible versions will be selected with `expo install` against the stable Expo SDK when those phases begin. No mobile dependency workspace or mobile application is generated in Phase 1.
