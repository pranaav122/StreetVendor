# Administration application

## Session foundation

The application now runs on Next.js 16.4.4 with operator sign-in/out, live service
counts and protected route handlers. `src/server/core.ts` owns the session/proxy
rules; `runtime.ts` is marked server-only and shares one registry across route
bundles. Client components receive user/count responses, never API credentials.
Business reviews, business/account controls, reports and audited visit inspection
are implemented. Public hosting and operational deployment verification remain
in progress.

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
| `/api/backend/vendors/{uuid}` | GET | Public business metadata for staff review |

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

## Business reviews and controls

The default tool lists pending review submissions, with verified/rejected filters
and pagination. Each card shows the submitted public note and its business ID.
`View business details` fetches the public description/categories; it does not
fetch a precise location. Staff provide at least ten characters explaining an
approval or rejection. The interface renders the committed backend result and
refreshes the queue/counts after decisions or competing changes.

`Business controls` accepts a business ID and recorded reason. Suspension stops
sharing and changes the verification state to suspended. Returning to review
keeps the business offline in pending status; approval remains separate. A pending
submission is needed for another approval. The response shows the last confirmed
state and owner account ID, rather than inventing a successful local change.

The extended proxy still rejects precise tracking paths. Its public-metadata
allowlist regression failed before implementation. **12 core tests**, strict
shared/Next checks and the production build pass. **6 browser cases passed in
55.9 seconds**, including actual approve/reject decisions, online-business
suspension removing sharing, return to pending/offline, and the earlier staff
session/Origin/revocation cases. Backend results were independently read through
authenticated HTTP; no business response was mocked.

## Reports, visit inspection and accounts

Reports support open/resolved views, pagination and recorded resolution reasons.
`Inspect visit` performs an authorized backend read and opens its result in the
inspector. Manual inspection by UUID is also supported. Inspections are explicit,
not background polling, because each backend read records a staff audit event.
The inspector shows identities, states, versions, meeting labels and deadlines;
it does not display the precise vendor point.

Staff cancellation requires a reason and the last inspected version. A competing
decision returns a conflict, then the UI reads committed state without retrying
the write. Cancellation is unavailable for terminal visits. Account controls use
IDs from reports/inspections: suspension revokes sessions and stops sharing;
restoration permits a new login but does not restart sharing. The API rejects
self-suspension, while the still-valid operator session remains usable.

Client requests are bound to the login scope that created them. Old asynchronous
callbacks cannot start a request under a later operator login. Private queries
are cancelled and cleared on sign-out or lost staff authorization.

**3 additional browser cases passed in 44.8 seconds** with real Node/FastAPI/
PostgreSQL: report inspection/cancellation/resolution, account suspension/
restoration/new login with sharing still off, forbidden self-suspension, and a
competing vendor acceptance against staff cancellation. Core tests remain **12
passing** and strict shared/Next checking passes. The production build also passes.

## Repeating the combined checks

Build the admin app first, then run the isolated browser suite from PowerShell:

```powershell
npm run build --workspace @mystreetvendor/admin-dashboard
$env:TEST_ADMIN_PRODUCTION = '1'
./scripts/Test-Applications.ps1
Remove-Item Env:TEST_ADMIN_PRODUCTION
```

The flag tests compiled Next code rather than the development compiler. It still
uses local HTTP and a development cookie, so it does not prove public TLS. Next
warns that its standalone deployment should use the generated `server.js`;
the production package must use that entry point. The browser suite checks the
390-pixel layout and saves an ignored synthetic business-review screenshot.
That screenshot was visually inspected: controls, IDs and review text wrap
within the screen without horizontal overflow.

On 4 November the compiled-server run passed all nine admin browser cases
against the real isolated API/database. The remaining Customer/Partner cases
continue in the same run; their final result is recorded separately. The current
admin core suite passed all 12 cases, and shared/Next strict checking passed.
