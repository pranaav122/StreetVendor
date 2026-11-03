# Administration application

## Session foundation

The first checkpoint implements the server session/proxy core in
`apps/admin-dashboard/src/server/core.ts`. The Next.js routes and operator screens
are the next checkpoint; this core alone is not a running dashboard.

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
implementation. They do not establish Next.js routing, a real backend round trip
or an operator browser workflow; those remain for the next checkpoint.

```powershell
npm run test:admin
npm run typecheck
```
