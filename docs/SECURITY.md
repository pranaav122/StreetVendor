# Security and privacy

Updated 4 November 2026. These controls are implemented and have local evidence in [LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md). Public deployment, provider delivery and physical-device behavior remain separate gates.

## Enforced boundaries

- The API derives the actor from a signed access token and checks current account/session state. Registration selects only its fixed customer/vendor role. Staff creation is an interactive operator command.
- Passwords use Argon2id. Access JWTs last 600 seconds; opaque refresh families have an absolute 30-day lifetime. Only refresh hashes are stored, rotation detects reuse, and account-first locks coordinate logout/revocation with refresh.
- Recent authentication protects destructive account actions. Reset/verification tokens are hashed, single use and purpose-bound. Production mail requires encrypted transport; local Mailpit does not send to real recipients.
- PostgreSQL abuse counters survive failed requests and restarts. Caddy overwrites client identity; private Node forwards it only for login, and the API trusts only the two reserved proxy addresses. Node/API have no public production ports. Origin checks and CORS have separate roles; neither proves a raw HTTP caller's identity.
- Staff cookies contain a random opaque session handle with HttpOnly, Strict, host-only and production Secure attributes. API tokens stay in the server registry. Mutations require the exact configured Origin; proxy paths and query fields are allowlisted. Role/account state is rechecked by the API.
- Precise vendor tracking is restricted to live participants in accepted/approaching/arrived work. Coarse discovery, bounded search, signed actor-bound cursors, freshness and state checks apply independently of the UI. Admin inspection is audited and does not grant a general exact-GPS endpoint.
- Offline/suspension/deletion erases the latest fix in the state transaction. Bounded maintenance physically removes abandoned stale fixes. Closed meeting points and old event/device/payload data have the deadlines in [DATABASE.md](DATABASE.md).
- WebSockets authenticate in a bounded first frame. Send-time resolution rechecks authority, and IDs rather than private coordinates wait in bounded queues. Expiry, logout, unsubscribe and terminal states stop protected delivery.
- Device ownership includes installation, user, app/project and session family. Outbox delivery rechecks relevance; generic alerts contain identifiers. Taps must reauthorize through REST. Retry ambiguity can duplicate an OS alert.
- Production runtime uses a non-root container and restricted database role. Migration/bootstrap credentials are separate. JSON request logs omit query strings, bodies and credentials; backups and private configuration are ignored by Git.

Native SecureStore holds each app's token pair. Browser mobile previews use memory only. A compromised phone, browser extension or trusted server operator remains a relevant threat; these controls do not establish physical device integrity.

## Source review and remediation

Codex Security scan `3e10a132-3eb0-428b-9c88-6933cdfb5271` completed on source revision `d54959401f788a8249e444a28f56117e48f44687`. It fully read 307 source paths; generated lockfile metadata was reviewed separately. Installed dependencies, private state, physical devices, providers and public server/TLS were excluded. The report is an offline source review, not penetration testing.

The sealed report contains two findings: medium severity shared admin-login IP limits, and low severity stale precise-location retention. Later fixes are separate from that historical snapshot:

| Finding | Fix and observed regression |
|---|---|
| Stale exact point remained stored after disconnect | [d70cedb](https://github.com/pranaav122/StreetVendor/commit/d70cedbd5832f82e032e82596134b9a37137456b): a 91-second-old row first failed the storage assertion; bounded locked cleanup then passed fresh/stale/writer cases and relevant suites. |
| Failed anonymous admin logins blocked unrelated operators | [769eb3d](https://github.com/pranaav122/StreetVendor/commit/769eb3d80c1bde8be7ea0926fc58e855f7844ee0): regressions first failed forwarding/ingress checks; real local Caddy/API tests then preserved separate client limits and overwrote forged headers. |

On this workstation the authoritative report is at `C:/Users/prana/.codex/state/plugins/codex-security/scans/mystreetvendor/d54959401f788a8249e444a28f56117e48f44687_20261104T073955Z_ht4hmzf8/report.md`, alongside canonical findings, coverage and threat model. The sealed report is retained unchanged. Local regression results support the fixes; there has been no second repository scan or public security certification.

The plugin reported partial token accounting: 25,206,289 total tokens (25,133,497 input, 72,792 output; 24,523,648 cached), with seven missing thread rollouts. This includes linked historical project context and is not reliable audit-only usage or billing.

## Open release decisions

Five moderate Expo build-tool dependency alerts remain; see [DEPENDENCIES.md](DEPENDENCIES.md). Before public use, resolve that toolchain gate, choose/enforce retention for expired refresh history and minimal staff/audit records, review admin MFA/access restrictions, approve the pilot polygon and support/privacy policy, pin reviewed deployment images, and exercise actual server/provider/device flows.

Backups are custom-format PostgreSQL archives, not encrypted merely because they are binary. Operators must encrypt/restrict off-server copies, schedule backups, rehearse restoration and define expiration. Host administrators and Docker operators can read environment secrets and remain trusted.

A phone can falsify location. Freshness, accuracy, monotonic updates and two-fix arrival reduce mistakes but cannot prove a visit occurred. Background-only Partner sharing stops by the access token's remaining expiry; it does not silently refresh from a headless callback. No payment or sale is inferred from completion.

## Reporting and investigation

Keep credentials, exact locations and private dumps out of public issues. Reproduce with synthetic accounts and an isolated database. Record the request ID, route template, time, observed status and expected rule. Avoid enabling SQL/body/access-query logging on real users. Revoke affected sessions and use the documented operator/recovery path when needed; do not bypass authorization to make a test pass.
