# Debugging the foundation yourself

Status: Phase 0 runbook; the implementation and verification report will record what was actually exercised. Future-feature sections are guidance for later phases, not claims of current functionality.

## Start with evidence

Reproduce the smallest failing action and note its time, HTTP status, response and relevant logs. Locate the failing boundary before editing code: PowerShell → Docker engine → API listener → application configuration → database connection → migration/PostGIS. Change one thing and repeat the same check. Do not rewrite the project or erase the database to hide an error.

Run commands from the repository root. If necessary, add Docker to this shell's PATH as shown in [DEPLOYMENT.md](DEPLOYMENT.md).

```powershell
docker version
docker compose --env-file .env -f infrastructure/compose.yaml config --quiet
docker compose --env-file .env -f infrastructure/compose.yaml ps
docker compose --env-file .env -f infrastructure/compose.yaml logs --tail 100 api db
```

Use `config --quiet` when sharing output. Plain `config` may expand and print your password. The database connection URL and `.env` are secrets.

## Inspect HTTP independently

```powershell
curl.exe -i --max-time 10 http://127.0.0.1:8000/health
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 10
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/openapi.json' -TimeoutSec 10
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
```

`curl.exe` selects the actual HTTP client, avoiding PowerShell's historical `curl` alias. A healthy response is HTTP 200 with `status`, `database`, and `postgis` all `ok`. A database outage is HTTP 503; a missing PostGIS installation also produces 503. A 404 means an HTTP server answered but that route was not found. Connection refusal means there is no listener at that address/port. A timeout means the server or a dependency did not respond within the limit. `/health` is dependency readiness, not a substitute for migration inspection or functional tests.

## Inspect PostgreSQL directly

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose --env-file .env -f infrastructure/compose.yaml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_database(), current_user, version();"'
docker compose --env-file .env -f infrastructure/compose.yaml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT PostGIS_Full_Version();"'
docker compose --env-file .env -f infrastructure/compose.yaml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version_num FROM alembic_version;"'
docker compose --env-file .env -f infrastructure/compose.yaml exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

In the interactive SQL shell, use `\dt` to list tables, `\dx` to list extensions, `\d alembic_version` for its structure and `\q` to exit. Business tables do not exist in Phase 1. Extension-owned spatial tables are expected; they are not application entities. `pg_isready` proves the server accepts connections; a SQL query using the real application credentials is the stronger application connectivity check.

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml run --rm api alembic -c alembic.ini current
docker compose --env-file .env -f infrastructure/compose.yaml run --rm api alembic -c alembic.ini heads
docker compose --env-file .env -f infrastructure/compose.yaml run --rm api alembic -c alembic.ini upgrade head
```

`current` reads the database's revision; `heads` reads the latest revision in the files. They should match after upgrade. `Base.metadata.create_all()` is not used: it would bypass the migration history. Downgrade tests run only in disposable test databases. The initial downgrade intentionally leaves PostGIS installed because extensions may be shared and dropping one can destroy dependent objects.

## Common failures and their causes

| Symptom | Likely cause and focused check |
|---|---|
| `docker` is not recognized | Docker's executable directory is missing from PATH. Use its installed full path or the temporary PATH command. |
| Cannot connect to Docker engine | Desktop is stopped, wrong context, or WSL/virtualization failure. Inspect `docker version` and Desktop before changing Python. |
| Compose reports an unset variable | Missing `.env`, wrong working directory, or an empty required value. Use explicit `--env-file .env`. |
| Database password authentication fails | App values differ from the credentials stored in the existing volume. Editing `.env` does not reset PostgreSQL. Use an authorized SQL password change and update the app value, then recreate the API container. |
| Hostname `db` fails in Windows Python | `db` exists only on the Compose network. Use `POSTGRES_HOST=127.0.0.1` on Windows. |
| API container cannot connect to `localhost` | Inside that container, localhost is the API itself. Compose must pass `POSTGRES_HOST=db`. |
| Port 5432 or 8000 is already allocated | Another service or project is listening. Inspect `Get-NetTCPConnection`; change the matching local port in `.env` and your URL. Do not stop unrelated services. |
| PostGIS function does not exist | Connected to the wrong database or initial migration has not enabled the extension. Check `current_database()`, `\dx`, and Alembic. |
| Relation `alembic_version` missing | Migration was not applied to this database. Verify host/database before running `upgrade head`. |
| Connection works but health is 503 | Inspect safe API warning type and verify `PostGIS_Full_Version()`; readiness checks both dependencies. |
| Unit tests pass but containers fail | Mocked tests check response behavior only. Run real database integration tests and a live HTTP request. |
| File edits have no effect in Docker | The image contains the old source. Rebuild and recreate `api`; there is no development source mount. |
| Windows Python ignores the root `.env` | Run from the repository root, or supply process environment variables explicitly. |

Do not include a password in screenshots, shell history, debug watch exports or public bug reports. Health errors log an exception class and safe context, rather than a full database error containing connection details.

## Set a Python breakpoint

Use the optional local Python workflow in [DEPLOYMENT.md](DEPLOYMENT.md), with PostgreSQL still running in Docker. In an IDE, select `.venv\Scripts\python.exe`, set working directory to the repository root, launch module `uvicorn` with arguments `app.main:create_app --factory --host 127.0.0.1 --port 8000`, and set a breakpoint in `backend/app/health.py`. Avoid `--reload` during your first breakpoint session because it creates a child process.

Send `/health` from another terminal and step into `get_db` and `session.execute`. Inspect the query and response, without exporting the password or connection URL. A SQLAlchemy engine is a connection manager; it does not open a database connection merely because it was constructed. The first SQL operation is where many connection failures appear.

## Reproduce database failure and recovery

This temporarily interrupts only this project's local database. Keep the API running so the same process must recover its pool.

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml stop db
curl.exe -i --max-time 10 http://127.0.0.1:8000/health
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait db
curl.exe -i --max-time 10 http://127.0.0.1:8000/health
```

Expected: 503 during the outage and 200 after recovery. SQLAlchemy `pool_pre_ping` checks borrowed connections and replaces stale ones; it does not replay interrupted business transactions. Later writes must handle rollback and idempotent retries deliberately. Do not use `down --volumes` for this experiment.

## Future application debugging — not implemented

- **Mobile UI:** use React Native DevTools and development-build device logs; inspect component state and TanStack Query state separately. Reproduce on a physical device when permissions/background operation matter.
- **HTTP/auth:** inspect method, endpoint, status, request ID and expiry. Redact authorization headers. Trace refresh rotation on the server; avoid retries that create duplicate requests.
- **GPS:** Phase 4 adds a deterministic simulator. Test stale timestamps, inaccurate fixes, out-of-order samples, disabled sharing and network reconnection. Compare captured time with server receipt time and the selected coordinate system.
- **WebSockets:** inspect connection/auth result, subscription authorization, event ID/version and reconnect resynchronization. A socket event is a hint to refresh authoritative REST state, not proof of a committed action on its own.
- **Push:** trace committed request event → outbox row → provider ticket → delivery receipt. Check token invalidation and retry state. A successful provider submission is not proof the phone displayed an alert.

## Resolved issues and verification

The read-only environment inspection found Docker installed per-user but absent from PATH. Calling its full path returned both client and Linux server versions successfully. The temporary PATH command fixes shell discovery without reinstalling Docker or changing global settings.

Implementation issues and executed results will be added to the verification report with their evidence. Do not treat the expected outputs in this runbook as executed results.
