# Application workspace

`customer-app` and `vendor-app` are independent Expo SDK 58 applications. They have separate routes, session providers, public configuration, app identifiers and EAS build files. Customer workflows now include registration/recovery, English/Tamil, manual or permission-based discovery, maps, requests/tracking/history/reports and guarded account controls. Partner includes business/review, consent-based sharing, incoming visits, navigation/history/reports and account/recovery. Staff has a separate Next dashboard. See the [current project handbook](../docs/PROJECT_HANDBOOK.md). They share the typed HTTP/realtime transport, response contracts and design tokens.

From the repository root in PowerShell:

```powershell
npm ci
npm run web --workspace @mystreetvendor/customer-app
# In another PowerShell window:
npm run web --workspace @mystreetvendor/vendor-app
```

Customer uses port 8081; Partner uses port 8082. The default API origin is `http://127.0.0.1:8000`. Each app can have its own ignored `.env` copied from `.env.example`. Public Expo variables are included in the app bundle: put no signing key, database password or Expo server access token there.

The browser preview keeps login credentials in memory. Reloading the page signs the preview out. Native builds use SecureStore. `com.mystreetvendor.customer` and `com.mystreetvendor.partner` are initial independent identifiers; store ownership and final release identifiers need owner confirmation before publishing.

Use the `development` EAS profile for native development clients. Background location is configured only for Partner. Configuration does not start sharing or prove background delivery. Expo project ownership, signing, native map configuration and remote push still need real build/provider/device checks. Neither project contains a fabricated EAS project ID.

The local API currently listens only on the computer's loopback interface through Docker. Physical phones cannot reach that address. Device setup will require an explicitly reachable development API, an appropriate API origin, and Windows firewall configuration; do not expose PostgreSQL to the phone or public internet.

Run `./scripts/Test-Applications.ps1` for browser checks. It creates a disposable PostgreSQL database, migrates and seeds it, starts a separate loopback API on port 8001, runs Playwright, stops that API and removes only the generated database. It uses the existing local PostgreSQL service and does not change development accounts. Ports 8001, 8081, 8082 and 3000 must be free. You can pass a test path, for example `./scripts/Test-Applications.ps1 tests/e2e/customer-auth.test.ts`.

Windows uses installed Microsoft Edge; other environments need Playwright Chromium installed. Traces/video are disabled because login traffic includes credentials. Test outputs remain ignored by Git. The lower-level `npm run test:ui` uses the development API unless `TEST_API_URL` is supplied; use the PowerShell wrapper for isolated runs and privileged synthetic fixtures.
