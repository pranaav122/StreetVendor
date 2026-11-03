# Customer and Partner recovery links

The Customer app has public `/reset-password` and `/verify-email` routes. The mail link carries its one-use token in a fragment, which browsers leave out of HTTP requests. The app reads that fragment, removes it from the visible URL and keeps the token in memory. A reload after scrubbing requires reopening or pasting the email link.

Partner now has its own equivalent public routes and root link listener, using
`mystreetvendor-partner:` instead of the Customer scheme. Its local email links
use port 8082 and its own in-memory recovery context. The Partner parser rejects
Customer-scheme links. Resetting a Partner password also clears its local session
and sharing task; native mail dispatch and OS cleanup still require device checks.

`recovery-link.ts` accepts only recognized actions and a single bounded fragment token. It rejects query tokens, duplicate values and unrelated paths. `RecoveryLinks.tsx` captures browser startup links and native initial/warm-link events. `RecoveryScreen.tsx` submits only after the user explicitly confirms; merely opening or previewing a message does not consume its token. The manual-link field is masked and never navigates to an entered URL.

Password reset requires matching 15–128-character passwords. The API consumes the hashed one-use token and revokes all existing sessions. The app also clears its own local session. Email confirmation refreshes account state when a matching session is open. Both flows display the backend's invalid/expired-link result and allow a different link.

Local tests send real SMTP messages to Mailpit, find only their synthetic recipient, open the contained link in Edge and check the resulting account state. They do not prove internet mail delivery, universal-link association, native mail-app dispatch or a signed native build. Production needs an actual public application URL, verified sender and device checks. Keep provider passwords out of mobile configuration.

Run the two local mail/browser checks with:

```powershell
./scripts/Test-Applications.ps1 tests/e2e/customer-recovery.test.ts
./scripts/Test-Applications.ps1 tests/e2e/partner-recovery.test.ts
```

PostgreSQL and the local Mailpit service must be running. The runner explicitly uses the loopback SMTP inbox; it does not relay test messages to real recipients.
