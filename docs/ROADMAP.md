# MyStreetVendor roadmap

Status: 21 October 2026. Phase 0 defines the complete design. Only Phase 1 implementation is authorized. Phase 2 and every later phase require approval before work begins. There are no mobile applications in the foundation milestone.

## Phase boundaries and acceptance criteria

| Phase | Deliverable | Evidence needed before calling it complete |
|---|---|---|
| 0 — System architecture | Architecture, complete proposed schema/ER diagram, REST and WebSocket contracts, security/authentication, location/request/push flows, deployment design and debugging plan | Documentation review for consistent names, actors, privacy rules, transactions, risks and scope; all future features labeled planned |
| 1 — Backend foundation | FastAPI, environment configuration, SQLAlchemy, PostgreSQL/PostGIS in Docker, Compose, Alembic, `/health`, basic automated tests and PowerShell instructions | Image build and Compose validation; running database; real PostgreSQL/PostGIS queries; applied Alembic head; health success and safe failure; automated tests and recovery check with actual results recorded |
| 2 — Authentication | Customer/vendor registration, password login, short-lived access tokens, rotating/revocable refresh sessions, logout and account authorization | Argon2id verification tests, invalid credentials, expiry, refresh reuse/revocation, suspended/deleted accounts, role escalation and rate-limit tests |
| 3 — Vendor management | Profiles, categories, admin verification and online/offline availability | Ownership/role tests, verification enforcement, audit history, invalid category/profile input and offline discovery exclusion |
| 4 — Vendor location | Validated GPS updates, latest location, PostGIS nearby queries, privacy filtering and mock GPS simulator | Metre-based boundary tests on real PostGIS; stale/future/inaccurate/out-of-order samples; fresh/verified/available filters; privacy and offline behavior |
| 5 — Request system | Create, accept/reject, cancel, expire, progress and complete visits | Participant authorization; allowed/invalid transitions; idempotency; concurrent acceptance/cancellation; transaction rollback and durable history |
| 6 — Realtime updates | Authenticated WebSockets, authorized subscriptions, location/request events and reconnect synchronization | Subscription isolation, token expiry/revocation, duplicate events, stale connection cleanup, bounded messages, reconnect and REST state reconciliation |
| 7 — Push notifications | Device tokens, durable SQL outbox, Expo provider adapter, retries, receipts and approach/arrival alerts | Commit/provider-failure separation; invalid-token retirement; duplicate job prevention; receipt handling; real-device permission and delivery checks |
| 8 — Customer mobile app | Independent Expo app with account, nearby map/list, filters, vendor profile, request/tracking/history and accessible permission states | Component/flow tests, expiry and refresh behavior, cancellation, network loss, denied permissions and physical-device API access |
| 9 — Vendor mobile app | Independent Expo app with verification/profile, Tamil/English UI, availability, visible sharing, GPS and visit progress | Foreground/background/terminated-app tests, battery/permission handling, large accessible controls, reconnect and request state recovery |
| 10 — Production preparation | Security/integration review, Ubuntu deployment, HTTPS/WSS, monitoring, backups, restore and rollback, small pilot | Clean deployment rehearsal; no public database port; restricted credentials; off-server restore drill; load/privacy tests; physical-device end-to-end results and pilot support ownership |

Foundation migrations create only the PostGIS baseline and Alembic revision history. The proposed business tables in [DATABASE.md](DATABASE.md) are introduced with their features. Authentication code is not part of Phase 1. The customer and vendor apps are not scaffolded early merely to match the final repository diagram.

## Incremental working method

For each approved feature, explain its behavior and purpose, identify the files, implement a small coherent change, run relevant verification, and explain the important functions and data path. Diagnose the observed root cause before repairing a failure. Keep a record of resolved problems in [DEBUGGING.md](DEBUGGING.md). Show the Git diff and make a local checkpoint after a meaningful milestone.

An attempted command is not a passed test. Record the environment, command, result, and limitations. A mocked HTTP test validates handling but does not prove Docker or PostgreSQL works. A real health query validates connectivity but does not prove the entire planned business schema exists. Tests for unimplemented features remain roadmap work, not passing placeholders.

## Learning questions at each milestone

### Phase 0

1. Which component decides whether a vendor's precise location can be revealed?
2. Why is a visit event written in the same transaction as its state change?
3. What is the difference between planned architecture and implemented functionality?

### Phase 1

1. Why does the API container use hostname `db`, while a Windows Python process uses a loopback address?
2. How does an Alembic revision differ from a SQLAlchemy session?
3. What does `/health` returning `503` tell you, and which logs would you inspect first?

### Phase 2

1. Why store password hashes and refresh-token hashes rather than plaintext secrets?
2. How does refresh rotation detect reuse of an old token?
3. Why must the backend choose the role allowed for a registration flow?

### Phase 3

1. Why are verification and availability separate states?
2. How is profile ownership checked?
3. Which records explain an administrator's verification decision?

### Phase 4

1. Why use `geography(Point,4326)` for distances in metres?
2. Why can a recent network receipt still contain an old GPS observation?
3. How could repeated precise discovery results reveal a vendor's route?

### Phase 5

1. How can two simultaneous requests to change one visit disagree?
2. What does an idempotency key prevent?
3. Why does a completed visit not imply a completed purchase?

### Phase 6

1. Why should a reconnecting app fetch current status instead of trusting missed socket events?
2. Why must subscription authorization be checked after connection authentication?
3. What happens to an in-memory connection map if a second API process is added?

### Phase 7

1. Why must push delivery happen after the visit transaction commits?
2. Why can a provider timeout cause a duplicate notification?
3. What does a push receipt prove, and what does it not prove?

### Phase 8

1. Which state belongs in React hooks, and which belongs in PostgreSQL?
2. Why should an obsolete nearby query be cancelled when the selected location changes?
3. How can the customer continue when location permission is denied?

### Phase 9

1. Why must the vendor see whether sharing is active?
2. Why can the operating system prevent an expected background GPS update?
3. What must be rechecked when the partner app reopens?

### Phase 10

1. Why is a backup without a successful restore rehearsal insufficient?
2. How would you identify whether a latency spike comes from SQL, HTTP, or notification delivery?
3. Why must a rollback plan consider database compatibility as well as container versions?

## Chennai neighbourhood pilot, planned

Begin with a deliberately small consenting group in one Chennai neighbourhood. Verify vendors before discovery, explain what location is shared and with whom, and provide Tamil and English onboarding. Use fictional test data until participating people understand the pilot. Name a person responsible for support, vendor suspension, privacy requests, incident response and daily operational checks.

Exercise a complete visit on physical customer and vendor devices: registration, verification, availability, discovery, request, acceptance, fresh tracking, approach/arrival and completion. Repeat with denied permission, poor GPS, weak network, app suspension, offline vendors and cancellation. Record failures with event IDs and timestamps while excluding precise coordinates and secrets from ordinary logs.

Measure successful discovery, request acceptance, cancellation/expiry, observed arrival quality and vendor battery impact. A completed visit is an engagement measure, not sales revenue. Collect feedback about legibility, Tamil labels, unexpected sharing, meeting-point clarity and notification usefulness. Set the success criteria and consent/retention choices before inviting a wider group.

## Scaling based on measurements

Collect a small baseline first: HTTP latency/error rates, SQL query latency and plans, connection-pool waits, database CPU/I/O/storage, fresh GPS proportion, open WebSockets, event delay, outbox job age/retries, and backup/restore duration. Establish service objectives from pilot expectations. Change one bottleneck at a time and compare the same workload before and after.

| Observed problem | First investigation | Possible improvement after evidence |
|---|---|---|
| Nearby search slows as records grow | Query plan, GiST usage, radius/result bounds, freshness filters and table statistics | Better indexes/query shape; maintain current-location table; later geographical partitioning only if justified |
| Repeated public reads consume significant database work | Request repetition, cache hit potential, invalidation and privacy impact | Small bounded cache; Redis only if cross-process sharing/eviction is needed |
| API CPU or request queues saturate while SQL is healthy | Blocking work, profiler, thread/pool limits and load test | Additional API instances after shared realtime fanout and consistent rate limiting are designed |
| WebSocket event lag or memory increases | Per-connection queues, slow clients, subscription cardinality and cleanup | Bounded queues and coalesced location messages; later broker and additional instances |
| Oldest outbox job age exceeds the alert objective | Provider latency/rate limits, retry policy, polling time and API contention | Separate job worker with leases and bounded concurrency |
| Database connections frequently wait | Leaked/long sessions, slow transactions, total connections per instance | Fix session lifetime; tune a measured pool; consider pooling infrastructure later |
| Sustained SQL read load limits the primary after optimization | Query mix, indexes, I/O and consistency requirements | Read replicas for tolerant reads; keep immediate authorization and state transitions on the primary |
| One VPS cannot meet recovery or availability objectives | Downtime cost, restore results, resource contention and operational capacity | Separate database or services and appropriate failover design |

Adding a city initially requires data and operational coverage rather than another backend deployment. Tune neighbourhood search and verification workflows first. Later demand aggregation, group visits, route recommendations, analytics and monetization each require an approved product definition, privacy review, schema changes and useful acceptance tests. No fixed user count automatically requires Redis, microservices, or a second database.

## Immediate stop condition

After the Phase 1 results and walkthrough are delivered, stop. Do not create registration/login endpoints, business models, mobile apps, notification integration, or production infrastructure until the corresponding work is approved.
