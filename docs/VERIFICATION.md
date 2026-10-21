# Phase 0 and Phase 1 verification

Executed locally on **21 October 2026** from Windows PowerShell. These are observed results, separate from the planned future architecture. No Phase 2 implementation was performed.

## Environment observed

| Component | Observed version |
|---|---|
| Windows Python virtual environment | Python 3.13.5 |
| Linux API image | Python 3.13.16 |
| Docker engine | 29.9.1, Linux/amd64 server |
| Docker Desktop | 4.96.0 |
| Docker Compose | v5.6.0 |
| PostgreSQL | 18.6, queried from the running database |
| PostGIS | 3.6.4, queried with `PostGIS_Lib_Version()` and full-version function |
| FastAPI / SQLAlchemy / Alembic | 0.157.0 / 2.1.5 / 1.20.0 |
| Pytest / HTTPX2 | 9.1.1 / 2.16.0 |

Other exact Python versions are in `backend/requirements.lock`. Image tags select the maintained Python 3.13 and PostgreSQL 18/PostGIS 3.6 families; they are not immutable digest pins. A later rebuild can receive newer image patches, so recheck versions and tests after pulling updated images. Production digest management is a later deployment task.

## Automated test results

| Execution | Final actual result |
|---|---|
| Windows: `.\.venv\Scripts\python.exe -m pytest -c backend/pyproject.toml backend/tests`, integration flag absent | **7 passed, 3 skipped**, 0.68 seconds; no warnings |
| Windows: same command with `RUN_DB_TESTS=1` | **10 passed**, 2.79 seconds; no warnings |
| Linux: `docker compose --env-file .env -f infrastructure/compose.yaml run --rm -e RUN_DB_TESTS=1 api python -m pytest` | **10 passed**, 2.23 seconds; no warnings |
| Dependency consistency, Windows and Linux: `python -m pip check` | **No broken requirements found** in each environment |

The Windows/Linux runs execute the same ten cases, not twenty distinct tests. The three skips in the default run are deliberate opt-in integration tests. The complete runs have zero failed or skipped cases.

### What the tests demonstrate

Four configuration tests cover password-safe URL construction/representation, required password, rejected empty password, and environment parsing. Three mocked HTTP tests cover health success, database failure, PostGIS failure and private-error redaction. Three PostgreSQL integration tests cover:

1. A genuinely clean database without PostGIS upgrades to the expected Alembic head; repeating the upgrade is safe.
2. Real HTTP health is 503 before PostGIS installation and 200 afterward. `geography` points between 100 and 120 metres apart are outside a 100-metre radius and inside 200 metres.
3. Downgrade/re-upgrade works in an isolated test database, preserves PostGIS, and leaves no application-schema drift. A visible `tiger` schema table remains intact during comparison.

Each integration case creates a generated `msv_test_<uuid>` database from `template0` and removes only that database afterward. The development database is never downgraded or dropped. A separate post-run query found **0 leftover disposable test databases**.

## Live service and infrastructure checks

| Check | Actual outcome |
|---|---|
| Compose configuration, `config --quiet` | Validated successfully |
| PostGIS image pull and final API image build | Completed successfully |
| Database startup with `up -d --wait db` | Healthy |
| Migration upgrade on development database | Applied `0001_enable_postgis`; later upgrades were already at head |
| Direct SQL revision inspection | `alembic_version.version_num = 0001_enable_postgis` |
| Alembic current/head and schema comparison | Current revision is head; **No new upgrade operations detected** |
| Offline migration SQL generation | Completed; generated extension creation and revision tracking SQL |
| Direct PostgreSQL and PostGIS queries | Returned server version, full spatial version and expected database/user |
| `GET http://127.0.0.1:8000/health` | **HTTP 200**, `{"status":"ok","database":"ok","postgis":"ok"}` |
| `GET /docs` | **HTTP 200** |
| `GET /openapi.json` | Responded; application paths contain only `/health`, with 200 and 503 response models |
| API operating-system user | `uid=1000(appuser)`, non-root |
| Final `docker compose ps` | `api` and `db` both healthy; ports bound to `127.0.0.1` |
| Secret exclusion | `.env` is ignored by Git and is outside the backend image build context |

### Database failure and recovery

The API remained running while this project's database was stopped using `docker compose ... stop db`.

1. Before the outage: HTTP **200**, all three health fields `ok`.
2. During the outage: HTTP **503**, `{"status":"error","database":"unavailable","postgis":"unknown"}`.
3. After `up -d --wait db`: HTTP **200**, all three health fields `ok`.

The API container start timestamp was unchanged across this sequence. The same running API recovered its database access. Direct SQL after restart still returned the applied migration revision, demonstrating that the database volume was retained. This is a local restart/recovery check, not a high-availability or backup restore test.

## Issues encountered and resolved

| Initial observation | Root cause and resolution |
|---|---|
| `docker` not found on PATH; full-path CLI pull failed to find `docker-credential-desktop` | Per-user Docker's executable directory was absent from the shell PATH. Adding that directory for the session resolved both; Docker was already installed and running. |
| First mocked test run: 7 passed, 3 skipped, 1 deprecation warning | Current Starlette deprecated the old HTTPX dependency. Checked its official documentation and pinned HTTPX2; final runs have no warning. |
| Live `alembic check` initially reported proposed geocoder table removals | The image sets `search_path` to `"$user", public, topology, tiger`; default reflection saw extension tables. The comparison applied no changes. Restricted migration transactions to `public`, excluded `spatial_ref_sys`, and added a search-path regression test. Final checks are clean. |
| First Linux test run: 10 passed, 1 cache warning | The non-root account could not write the optional Pytest cache under `/app`. Granted access to that cache directory; final run passes without warnings. |
| An ad hoc nested-shell SQL cleanup query had an unterminated quote | Quoting SQL literals across PowerShell and `sh` was unnecessarily complicated. Rechecked using a bound SQLAlchemy parameter; it returned zero leftover test databases. The simple documented SQL inspection commands ran successfully. |

Pip's image-build output warns about installing as root. Dependencies are installed into an isolated image during its build; the final API runs as `appuser`, as verified above. This is not a test failure. No dependency warning was hidden with a test warning filter.

## Boundaries and unexecuted work

- The full architecture/schema/contracts are documented. Business tables and business functionality are not implemented.
- Mermaid diagrams are supplied as source and were inspected for structure; no Mermaid rendering tool was used to visually verify them.
- Local Docker, host database access, migrations and tests were exercised. An IDE breakpoint session and the optional Windows Uvicorn listener were not launched.
- VPS provisioning, Caddy/HTTPS/WSS, production secrets/roles, automated backups, restore drills, production monitoring/load testing and physical-phone access were not performed.
- Authentication, authorization, mobile apps, GPS, request lifecycle, WebSockets, push notifications and their future tests do not exist yet. Their designs are not evidence those features work.
- Phase 1 uses a privileged **development** database bootstrap account to permit extension/migration/sandbox operations. The production restricted application account is a documented future deployment requirement.

The local `api` and `db` services are left running for inspection. Stop them with `docker compose --env-file .env -f infrastructure/compose.yaml down` to preserve database data. See [FILE_GUIDE.md](FILE_GUIDE.md) for every file and [DEBUGGING.md](DEBUGGING.md) to reproduce investigations independently.
