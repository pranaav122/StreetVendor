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
stops when the app leaves the foreground unless background sharing was explicitly enabled.
Native device verification remains in progress.

## Account and notifications checkpoint

Account settings save the user's name and preferred language, request email
confirmation and expose guarded deletion. Deletion requires typing `DELETE` and
recent authentication. Local sharing stops before deleting, logging out or
confirming another login; backend transactions revoke access and erase the point.
Cleanup attempts the operating-system stop even if keychain removal fails, and
a cleanup error cannot keep the signed-out user's private query cache visible.

Partner notification registration uses its own installation key and the `vendor`
app kind. Native permission is requested only on a supported physical build with
an EAS project configured. Existing granted registration refreshes on login/token
changes. Tapping an alert validates its UUIDs and checks live visit access through
REST before navigation; stale or another account's alerts cannot grant access.
The browser explains that remote delivery is unavailable and keeps the inbox usable.
Actual remote push delivery and notification taps still need phone/build/provider
verification. Native resume refreshes the live account before reconnecting sockets.

Account verification: **2 real browser cases passed in 27.9 seconds**, covering
saved profile data, unavailable browser push, sign-out hiding the business, the
deletion phrase guard and revoked access. Strict shared/Partner checking and all
14 Partner policy tests pass.

## Recovery checkpoint

Partner owns `/reset-password` and `/verify-email`, a root cold/warm-link listener
and a bounded fragment-token parser. It rejects query/duplicate tokens, unrelated
paths and the Customer native scheme. The browser removes the fragment from the
visible URL and keeps it in memory. A masked manual field accepts a different
link without navigating to it. Tokens are consumed only after explicit confirmation.

Two browser cases using actual loopback SMTP messages passed in **23.8 seconds**.
They confirm the changed password/revoked old session and the verified email in
PostgreSQL through authenticated HTTP reads. Partner policy tests now pass **16
cases**, including native scheme and malformed-link parsing. Strict shared/Partner
checks pass. Internet mail delivery and native link dispatch remain unverified.

## Joint browser workflow

The two independent browser applications completed a shared visit in **44.4
seconds** (one passing case). Partner went online using browser geolocation,
Customer found the business and requested a visit, and Partner accepted and
marked approaching. The browser then supplied two controlled geolocation events
six seconds apart; the actual Partner sensor adapter uploaded them through HTTP
and the actual backend marked arrival. Partner completed the visit, Customer lost
precise tracking, and Partner went offline. No API business response was mocked.

A controller regression also reproduced an immediate sensor callback repeating
the already committed first fix. It now establishes the upload throttle before
subscribing; all **17 Partner policy tests** pass. This workflow verifies browser
geolocation transport and server arrival rules, not native background scheduling.

## Visit management checkpoint

The inbox separates active visits from loaded history and supports pagination.
Each detail screen reads the server's allowed actions and sends its current
version with accept, decline, approach, cancel or complete. Declining and
cancelling require a reason in this interface. A conflict displays the backend
message and reloads committed state; the interface never invents a successful
transition. Active details poll and the session's authenticated socket invalidates
visit queries after events or reconnect.

Accepted, approaching and arrived visits show the public meeting point and an
explicit external-map button. Opening it shares that point with Apple Maps on
iOS or Google Maps elsewhere. Terminal visits hide those controls. Arrival still
requires the backend's two accurate fixes separated by five seconds; there is no
manual arrival shortcut. Participants can submit a categorized report. Completed
visit counts remain separate from purchases or payments.

English/Tamil labels cover visit actions, states and sharing controls. In the
390-pixel browser check, the Tamil dashboard preserves the entered business name,
wraps text and keeps the primary control at least 52 pixels tall. The preview was
visually inspected; physical-device wording/accessibility review is pending.

Visit verification: **3 browser cases passed in 37.4 seconds**, covering real
acceptance/approach/two-fix arrival/completion/history, decline with persisted
reason, and competing decisions through two real API sessions. The Tamil browser
case passed separately in **24.8 seconds**. Partner policy tests now pass **14
cases**; shared/Partner strict checks and the Partner web export pass. External
map launching and physical GPS remain unverified on phones.

## Native background adapter

`src/location/background.ts` registers the task at module scope. A separate
permission button enables the background mode for the next explicit online
action. It requires a native development build, foreground/background permission
and the location capabilities already declared in the Expo configuration.

Only consent metadata and the last successful upload time are persisted; a route
is never stored. Each callback reads current SecureStore credentials and checks
the consent user, session family and start time. It uploads only the newest
usable sample, without rotating credentials. Expired/revoked access stops sharing.
The background-only window is therefore at most the remaining **600-second**
access lifetime. Reopen Partner, revalidate the account and explicitly go online
to resume. Device settings or termination may stop updates sooner.

Consent and upload status have separate storage keys. An old task writing its
last upload time cannot recreate consent after logout. Status carries a consent
nonce, so a new online session ignores old status. Offline/logout clears consent
and unregisters the location task. These native paths are implemented but still
require installation and physical Android/iOS permission, termination and resume
checks; browser geolocation and JavaScript bundles cannot prove OS scheduling.

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

The subsequent background-policy checkpoint has **13 passing Partner policy
tests**, strict shared/Partner TypeScript checks, **20/20 Expo Doctor checks**,
and **2 passing browser cases in 29.3 seconds**. The browser also checks the clear
unavailable message for native background permission. Web, iOS and Android
JavaScript exports pass; the native Hermes bundles are about 3.6 MB each.

Run the browser case in PowerShell from the project folder:

```powershell
./scripts/Test-Applications.ps1 tests/e2e/partner-profile.test.ts
```

The runner starts both Expo browser servers and a temporary backend. It creates
and removes only its own randomly named browser-test database. PostgreSQL and
Mailpit must already be running locally.
