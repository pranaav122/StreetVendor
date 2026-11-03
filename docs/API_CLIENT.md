# Shared application client

`packages/api-client` owns HTTP authorization and session coordination. `packages/shared-types` validates token responses and realtime messages and defines the business response types. Neither package contains application screens.

Create one `ApiClient` per running application with an API origin, a `SessionStore` and `onSignedOut`. The native store adapter must use SecureStore. Browser previews should keep credentials in memory rather than local storage. The administration application will use its separate server boundary.

Call `request('/users/me')` for `/api/v1/users/me`. Pass `authenticated: false` for registration, login and recovery. The default is authenticated. Absolute URLs are rejected so callers cannot send credentials to another host. HTTPS is required unless local development is explicitly enabled. Requests have a fifteen-second fetch timeout and accept a caller cancellation signal.

Concurrent unauthorized requests share one refresh operation. A delayed 401 retries with an access token already rotated by another request. A rejected refreshed access token ends the session rather than looping. Temporary refresh failures retain the stored session for a later explicit retry; rejected credentials clear it. Persisted changes are serialized, and generation checks prevent delayed responses or failed writes from restoring or clearing the wrong account.

`onSignedOut` must cancel private queries, clear their cache and close realtime subscriptions. It runs even if clearing durable storage fails. The app must surface that storage failure and avoid presenting the session as saved. App sign-out should attempt the backend logout endpoint before local cleanup; the backend remains responsible for revoking other devices.

The exported types reflect current backend responses. `parseServerMessage` returns null for malformed JSON, unknown message types, invalid identifiers, invalid locations and oversized input. Clients must resynchronize visits through REST after reconnect; messages are hints rather than durable business state.

Checks from PowerShell:

```powershell
npm ci
npm run test:client
npm run typecheck
```

Current evidence: sixteen local tests pass, including concurrent refresh, rejected refresh, sign-out during refresh, bounded retry, cancellation, host protection, temporary provider failure, late 401 handling, an old storage failure racing a new sign-in, realtime authentication/subscription cleanup and corrupt stored sessions. These are deterministic client tests, not native storage or phone-network checks.

`RealtimeClient` authenticates with a first frame, sends application heartbeats, renews access through the same HTTP refresh coordinator and reconnects with bounded backoff. Reconnect triggers REST resynchronization. Unsubscribed coordinates are discarded locally; stopping during a pending storage read cannot open an old account's socket. Applications invalidate REST queries instead of treating socket payloads as the source of truth.

`pause()` closes the current connection and timers while keeping desired subscriptions for a foreground reconnect. `stop()` also forgets those subscriptions for sign-out. The Customer provider pauses on native background transitions, refreshes the account on resume and resets tracking queries before reconnect/resynchronization. This avoids displaying cached coordinates as newly authorized data. Native event timing still needs physical-device verification.

Each app owns its session provider and separate SecureStore key. The shared storage adapter accepts a native storage driver; it has no import of a mobile UI library. On native platforms the app configures device-only keychain access after first unlock, allowing authorized background callbacks without transferring sessions through device backups. Actual operating-system storage behavior still needs device testing.

The API applies the configured origin allowlist to HTTP browser requests as well as sockets. It allows bearer/JSON/idempotency preflights and does not enable cross-origin cookies. Local Customer/Partner origins on ports 8081/8082 are listed explicitly. Production must supply its actual web origins. CORS supplements authentication; native programs can make requests without a browser Origin header and still require valid authorization.

The selected mobile baseline is Expo SDK 58. The current official [workspace guide](https://docs.expo.dev/guides/monorepos/) and [Router installation guide](https://docs.expo.dev/router/installation/) govern package setup; native dependency compatibility is checked with `expo install` for each app.
