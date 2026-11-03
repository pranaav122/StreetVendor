# Partner application

The independent Expo application lives in `apps/vendor-app` and runs on port
8082 for local browser checks. It shares the typed HTTP client and design tokens
with Customer, but owns its routes, session storage and user interface.

## Implemented checkpoint: account and business setup

- Vendor registration and sign-in use the fixed vendor role. Browser credentials
  stay in memory; native credentials use a separate SecureStore key.
- Profile editing saves the business name, description and category IDs through
  the authenticated backend. Product categories come from PostgreSQL.
- Review requests accept a small public business note, with a warning against
  sending identity documents or private information. Staff approval remains a
  separate permission; submitting a request does not approve the business.
- Home reads the real review state and visit counts. Counts use India time and
  do not represent sales or earnings.
- English and Tamil interface text are supported for these screens. Business
  names, descriptions and review notes remain as entered.

## Foreground sharing checkpoint

Approved businesses can explicitly go online with a fresh, accurate first fix.
The foreground sensor then sends the actual captured timestamps, discarding
intermediate fixes instead of storing a route. Denied permission or poor accuracy
keeps the business offline. A failed sensor startup rolls back availability.

Going offline stops the local sensor immediately, waits for pending writes and
then asks the server to erase the point. Signing out also stops the sensor; the
backend logout transaction hides the business and removes its exact point.
Stale updates are visibly degraded after 90 seconds. Native foreground sharing
stops when the app leaves the foreground; background integration is still pending.
Visit management, complete account recovery and device verification remain in progress.

## Verification

On 3 November 2026, the Partner profile browser case passed against a temporary
PostgreSQL database and a real local FastAPI process: **1 passed in 20.2 seconds**.
It registered a vendor, saved categories and business details, requested review,
and independently read back the pending, offline profile through HTTP. Strict
Partner TypeScript checking and the web export also passed. A subsequent pair of
browser cases passed in **27.8 seconds**, including browser-supplied geolocation,
explicit online consent and an independently verified offline server response.
The location controller has eight passing safety cases covering cleanup races,
sensor failure, invalid fixes, degraded retries and stale status. These checks do not
establish native installation, background GPS or push delivery.

Run the browser case in PowerShell from the project folder:

```powershell
./scripts/Test-Applications.ps1 tests/e2e/partner-profile.test.ts
```

The runner starts both Expo browser servers and a temporary backend. It creates
and removes only its own randomly named browser-test database. PostgreSQL and
Mailpit must already be running locally.
