# Notification delivery

Visit state remains authoritative in PostgreSQL. A notification asks the recipient to open the app and fetch current state; it never grants access to a visit or contains meeting coordinates, names or report text.

## Registering an installation

An authenticated customer or vendor calls `PUT /api/v1/devices/{installation_id}` with `app_kind`, `platform` (`android` or `ios`), an Expo `project_id` UUID and `token`. The installation UUID is generated once by that application. The role must match the application. Production additionally requires the corresponding configured project ID. Tokens are accepted as secrets and never returned in responses.

Registration binds the installation to the current account and refresh-session family. Re-register after signing in, restoring a session or receiving a changed push address. Updating the same installation is idempotent. Ten enabled registrations per account are allowed by default, with a configurable maximum of twenty. A token already attached to a different installation returns a conflict.

`DELETE /api/v1/devices/{installation_id}` disables an owned registration. Logout disables registrations for that login family; logout-all, account deletion and suspension disable all owned registrations. An installation changing account, family or address loses its old delivery jobs before ownership changes. A late provider response cannot disable its new owner.

The registration response includes `delivery_enabled`. It is false without an Expo server access token. Successful registration does not establish operating-system permission or physical delivery.

## From visit transaction to push

1. A visit change, its versioned event and notification rows commit together. A rollback leaves none of those changes behind.
2. Each event/device/channel combination is unique. Payload data contains only `notification_id`, `request_id` and `event_type`.
3. The single maintenance worker claims at most twenty jobs using short transactions and thirty-second leases. It rechecks ownership, account/session status, event version and age before sending.
4. Expo calls happen outside database transactions. Batches are separated by application project. A rejected multi-message HTTP 400 batch is isolated into individual calls, with at most four concurrent calls.
5. Network failures, HTTP 429 and server errors retry with bounded exponential backoff, up to five send attempts. The alert lifetime is five minutes. Lease identifiers prevent stale workers from replacing newer results.
6. An accepted ticket schedules receipt polling fifteen minutes later. Missing receipts are checked again until the twenty-four-hour deadline. `DeviceNotRegistered` retires the current address.

`RECEIPT_OK` means the provider reported success. It does not prove that a person saw a notification. Delivery can duplicate when a network timeout hides a successful upstream send; clients should deduplicate by notification ID and always fetch current visit state.

## Configuration and privacy

The optional server settings are `EXPO_ACCESS_TOKEN`, `EXPO_CUSTOMER_PROJECT_ID` and `EXPO_VENDOR_PROJECT_ID`. Never put the access token in a mobile public environment variable or Git. The local Compose stack intentionally starts without push credentials. A later production configuration must explicitly pass the server settings.

Cleanup runs even when push is disabled: unsent alerts expire after five minutes, finished payloads are cleared after seven days, and disabled or unseen device addresses are deleted after thirty days. Device deletion cascades its delivery history. Cleanup releases visit/delivery locks before device deletion to preserve the registration lock order.

## Debugging and evidence

Start with the device response's `delivery_enabled`, the app's permission status and the configured project IDs. Inspect safe outbox fields (`status`, `attempts`, `receipt_attempts`, `next_attempt_at`, `last_error_code`) rather than printing addresses or credentials. `PENDING` is waiting, `SENDING` is leased, `AWAITING_RECEIPT` has a ticket, and `FAILED`/`SUPPRESSED` record a terminal reason.

The tests in `test_devices.py`, `test_outbox.py`, `test_notification_receipts.py` and `test_notification_retention.py` exercise real PostgreSQL transactions with a deterministic fake provider. `test_expo_provider.py` checks adapter shapes and secret headers. These checks establish local logic, not live Expo connectivity. Actual phone delivery, permission revocation and signed development builds remain device/provider checks.

Run these from the project root in PowerShell:

```powershell
$env:RUN_DB_TESTS = '1'
./.venv/Scripts/python.exe -m pytest -c backend/pyproject.toml backend/tests/test_devices.py backend/tests/test_outbox.py backend/tests/test_notification_receipts.py backend/tests/test_notification_retention.py backend/tests/test_expo_provider.py backend/tests/test_database.py -q
Remove-Item Env:RUN_DB_TESTS
```

The provider protocol follows the [Expo server guide](https://docs.expo.dev/push-notifications/sending-notifications/). Live integration has not yet been verified.

## Customer app adapter

The Account screen has an explicit Enable notifications action. The adapter checks native development-build support, a physical device and a configured project before asking permission. Android creates its notification channel before requesting permission. A stable SecureStore installation ID survives account changes; the server rebinds it to the live login family and removes old-owner jobs.

Already-permitted registrations are refreshed after sign-in/restoration and native token changes. The lifecycle listener removes its subscriptions on logout/account changes and suppresses foreground alerts without an active account. Notification taps validate bounded UUIDs and fetch the visit through authenticated REST before navigation. Old-account or expired alerts cannot grant access. A bounded in-memory ID set suppresses duplicate taps.

Twenty shared-client tests currently pass, including missing-configuration/no-prompt, denial/no-address and truthful disabled-server registration. The browser unavailable-state case passed against the local API in 13.7 seconds. These use a fake native driver or browser guard. Native permission, secure storage, token rotation, push taps and physical delivery remain unverified until an owner-controlled signed build and device are available. Offline logout cannot recall an alert already accepted by a provider; push text stays generic and REST continues enforcing access.
