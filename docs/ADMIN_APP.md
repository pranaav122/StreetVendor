# Administration application

## Session foundation

The application now runs on Next.js 16.4.4 with operator sign-in/out, live service
counts and protected route handlers. `src/server/core.ts` owns the session/proxy
rules; `runtime.ts` is marked server-only and shares one registry across route
bundles. Client components receive user/count responses, never API credentials.
Verification/report/action screens remain in progress.

The browser receives a random 32-byte opaque cookie. In production it uses the
`__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Strict` and `Path=/`, with no
Domain attribute. Access/refresh credentials remain in a bounded server-memory
registry, using the shared API client's refresh coordinator. The registry holds
at most 256 sessions with an absolute eight-hour lifetime. It requires one
self-hosted Node process; restarting it requires staff to sign in again.

Every protected request checks the account's live role/status through FastAPI.
Only active administrators are accepted. Rejected roles and failed session
allocation log out the newly issued backend family. Explicit logout discards
local authority even if upstream revocation fails; that failure is returned.

## Browser-facing contract

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/session` | POST | Validate operator credentials and set the opaque cookie |
| `/api/session` | GET | Return the current live operator without API tokens |
| `/api/session` | DELETE | Revoke the backend session and clear the cookie |
| `/api/backend/admin/...` | GET/POST | Forward an explicitly allowed staff operation |
| `/api/backend/requests/{uuid}` | GET | Audited backend visit inspection |

All mutation requests require the exact configured admin Origin. Cookie
SameSite rules provide additional protection. Login JSON is limited to 4 KiB;
action JSON to 16 KiB, including chunked requests. Body reading has a five-second
deadline. The backend still validates business payloads, authorization and
transaction boundaries.

The proxy permits only verification/report lists, summary, listed staff mutation
routes and explicit visit inspection. It validates list queries and rejects
authentication/token paths. Caller cookies and Authorization headers are never
forwarded; the shared client adds the server-held access token. Responses use
`Cache-Control: no-store`.

Production requires a public HTTPS origin. Plain HTTP API transport requires an
explicit local/container choice and is limited to `api`, `localhost` or loopback
hosts. It is not a fallback for public plaintext authentication.

## Verification

The core passed **11 focused Node tests** and strict shared TypeScript checking.
Tests cover cookie flags/secrecy, role rejection/revalidation, Origin checks,
allowed/denied forwarding, expiry/logout, bounded registry, ordinary/chunked body
limits and HTTPS/private-host configuration. Their API transport is a test
implementation. Separately, **4 browser cases passed in 44.9 seconds** against a
real local Next.js server, FastAPI process and disposable PostgreSQL database.
They cover the HttpOnly/opaque cookie and counts, sign-out, customer-role rejection,
a foreign-Origin suspension attempt leaving the business unchanged, and remote
staff suspension removing the console. The local HTTP cookie is development-only;
production Secure/prefix flags are covered by the core tests, not a public TLS test.

Strict Next.js checking and its production/standalone build passed on Windows.
The public shell is prerendered; both API route families remain dynamic and
uncached. The installed Next.js version generates `AGENTS.md` with its documentation
rule. Its managed `next-env.d.ts`, `.next` output and TypeScript build state are
ignored; `typecheck` runs `next typegen` before the compiler.

```powershell
npm run test:admin
npm run typecheck
npm run typecheck --workspace @mystreetvendor/admin-dashboard
./scripts/Test-Applications.ps1 tests/e2e/admin-auth.test.ts
```

## Local startup

Create an operator using the interactive command documented in
[authentication](AUTHENTICATION.md). There is no public staff registration or
hardcoded staff password. With the local API running, use PowerShell:

```powershell
$env:ADMIN_APP_ENV = 'development'
$env:ADMIN_API_URL = 'http://127.0.0.1:8000'
$env:ADMIN_PUBLIC_ORIGIN = 'http://127.0.0.1:3000'
npm run dev --workspace @mystreetvendor/admin-dashboard
```

Open `http://127.0.0.1:3000`. The test runner starts this server itself on port
3000, alongside Customer/Partner on 8081/8082 and an isolated API on 8001.
Public HTTPS hosting, container runtime and server restart checks remain for the
operations package.
