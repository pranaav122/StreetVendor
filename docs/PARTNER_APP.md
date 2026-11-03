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

Location controls, visit management, complete account recovery and native device
verification are still in progress. The current Home screen does not start GPS.

## Verification

On 3 November 2026, the Partner profile browser case passed against a temporary
PostgreSQL database and a real local FastAPI process: **1 passed in 20.2 seconds**.
It registered a vendor, saved categories and business details, requested review,
and independently read back the pending, offline profile through HTTP. Strict
Partner TypeScript checking and the web export also passed. These checks do not
establish native installation, background GPS or push delivery.

Run the browser case in PowerShell from the project folder:

```powershell
./scripts/Test-Applications.ps1 tests/e2e/partner-profile.test.ts
```

The runner starts both Expo browser servers and a temporary backend. It creates
and removes only its own randomly named browser-test database. PostgreSQL and
Mailpit must already be running locally.
