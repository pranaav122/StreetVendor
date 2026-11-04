# Delivery status and next work

Updated 4 November 2026. The full remaining MVP was approved on 2 November. Earlier Phase 1-only limits describe the old milestone. Plans retain dated intent; [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and [LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md) state current evidence.

## Implemented local software

| Area | Delivered |
|---|---|
| Foundation | FastAPI, PostGIS, SQLAlchemy, six Alembic revisions, Compose and safe health |
| Accounts | Fixed roles, Argon2id, rotating/revocable sessions, recovery, own account and interactive staff creation |
| Businesses/location | Bilingual categories, reviews/audit, consent, spatial discovery, protected tracking and stale-point erasure |
| Visits | Idempotency, versions, transitions, expiry, two-fix arrival, reports/history/privacy |
| Live delivery | Bounded authenticated sockets and durable session-bound outbox with retries/receipts |
| Customer | Independent Expo screens, meeting-point selection, discovery/maps, visits and account/recovery |
| Partner | Independent Expo screens, business/review, sharing adapters, visits/navigation and account/recovery |
| Staff | Server-held sessions, reviews/reports/accounts, summaries and audited inspection |
| Operations | Restricted images/roles, private proxies, safe logs, restarts, binary backup and isolated restore |
| Learning | Current handbook, every-file map and debugging instructions |

## Gates before real release

| Gate | Remaining evidence/decision |
|---|---|
| Infrastructure | Authorized server/domain/DNS/firewall and actual HTTPS/WSS hostname checks |
| Providers | Real encrypted SMTP/sender verification, separate EAS projects and push/device delivery |
| Signed apps | Owner identifiers/signing and Android/iOS installation/linking/maps |
| Native location | Physical foreground/background/resume/termination/battery/permission tests; background-only sharing ends by the remaining ten-minute access lifetime |
| Dependencies | Compatible verified resolution of five moderate Expo build-tool alerts |
| Privacy/operations | Approved pilot polygon, notices/support, expired-refresh/audit retention and purge, admin MFA/access policy, scheduled encrypted off-server backups |
| Deployment review | Image digests, host permissions, actual load/resources and monitoring |
| Design artifact | Correct the Figma draft's known layout defects when quota permits; local implementation is the current reference |

Invented credentials or successful simulations cannot replace those inputs. Local checks establish their own scope. Payments, inventory, sales accounting, public OTP, group requests, route optimization, demand aggregation and multi-city tooling remain later product work. Visit completion never implies a purchase.

One Minor from final review is deferred: concurrent point deletion between tracking reads can return a temporary dependency error/socket reconnect, requiring retry/resynchronization. Combining those reads and adding a controlled database-race regression is follow-up. The two Important review findings have failing-to-passing regressions and the complete final local check passed.
