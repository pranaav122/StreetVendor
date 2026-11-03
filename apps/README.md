# Application workspace

`customer-app` and `vendor-app` are independent Expo SDK 58 applications. They have separate routes, session providers, public configuration, app identifiers and EAS build files. Their feature screens are still being implemented. They share the typed HTTP/realtime transport, response contracts and design tokens.

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
