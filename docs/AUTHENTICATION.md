# Authentication and accounts

Core implementation added on 2 November 2026. Password recovery, email confirmation, operator bootstrap and later product features are subsequent slices of the approved plan; consult the current implementation status.

## Configure an independent signing key

The working `.env` already contains a generated development key. Keep it private. For a new checkout, first copy `.env.example` only if `.env` is absent, then replace the database-password and signing-key placeholders. Authentication rejects the public `replace-...` template value.

To generate a signing key in PowerShell without printing it, capture the random bytes and save the value in your private configuration:

```powershell
$taskBytes = New-Object byte[] 32
$taskRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$taskRandom.GetBytes($taskBytes)
$taskRandom.Dispose()
$taskSigningKey = [BitConverter]::ToString($taskBytes).Replace('-', '').ToLowerInvariant()
# Use this only if JWT_SECRET is absent; otherwise replace its existing private value.
Add-Content -LiteralPath .env -Value "JWT_SECRET=$taskSigningKey"
```

Never reuse the database password as a signing key, copy the actual key into an issue, or commit `.env`. Rotating this key invalidates existing access tokens. The production secret/role setup is part of the later deployment work.

## Current HTTP operations

| Method and path | Behavior |
|---|---|
| `POST /api/v1/auth/register/customer` | Validated account with fixed customer role |
| `POST /api/v1/auth/register/vendor` | Validated account with fixed vendor role, without granting verification |
| `POST /api/v1/auth/login` | Access JWT and random opaque refresh token |
| `POST /api/v1/auth/refresh` | One-time refresh rotation within the same absolute session-family deadline |
| `POST /api/v1/auth/logout` | Revoke the acting session family |
| `POST /api/v1/auth/logout-all` | Revoke all families after a recent login |
| `GET /api/v1/users/me` | Own safe profile using a bearer access token |
| `PATCH /api/v1/users/me` | Update only display name and language |
| `DELETE /api/v1/users/me` | Require confirmation `DELETE` and a recent login; anonymize and revoke access |

Registration JSON contains `email`, `password`, `display_name` and optional `preferred_language` (`en` or `ta`). Passwords must be 15-128 characters. Spaces and valid Unicode are preserved; passwords are never silently stripped. Email is normalized consistently. Unknown body fields, including a submitted role or status, are rejected.

The access token lasts 600 seconds and identifies the user/session family, not trusted client privileges. Every protected call checks the live account and active family in PostgreSQL. Refresh tokens have 48 random bytes before URL-safe encoding; only their SHA-256 hashes are stored. Rotation preserves a 30-day absolute family deadline and the original login time. Reusing an old token revokes the entire family.

Database row locks serialize account changes before session changes. This prevents a racing refresh from creating a child session that logout misses. Error responses include safe categories and omit raw submitted input, driver errors and password values. Database-backed rate limits survive API restarts; client code must coordinate refresh rather than submitting the same old token concurrently.

## Verification commands

Use the root environment and explicitly enable real PostgreSQL tests:

```powershell
$env:RUN_DB_TESTS = '1'
.\.venv\Scripts\python.exe -m pytest -c backend/pyproject.toml backend/tests -q
Remove-Item Env:RUN_DB_TESTS
```

Container tests use the same cases. Migration `0002_accounts` introduces the account tables; run explicit `alembic upgrade head` before starting a schema-dependent image. `/health` retains its foundation contract and is not a substitute for inspecting migration state.
