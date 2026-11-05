# Every-file guide

Updated 5 November 2026. This inventory explains every maintained Git file and the current handbook. Private `.env`, installed dependencies, databases, backups and generated test/export output are deliberately excluded. Start with [PROJECT_HANDBOOK.md](PROJECT_HANDBOOK.md), then use this map to follow an actual feature.

Inventory: **316 files**. Paths are repository-relative and linked from this guide. Tests describe the behavior they protect; their existence alone is not a passing result. Actual runs are in [LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md).

## Root settings

| File | Why it exists |
|---|---|
| [.dockerignore](../.dockerignore) | Excludes secrets, installed dependencies and generated files from the staff monorepo image context. |
| [.env.example](../.env.example) | Placeholder local configuration; copied privately, never a real credential source. |
| [.gitattributes](../.gitattributes) | Normalizes text and keeps Linux shell scripts LF-terminated. |
| [.gitignore](../.gitignore) | Excludes private settings, environments, dumps and generated output. |
| [AGENTS.md](../AGENTS.md) | Working scope, PowerShell conventions, comments and mandatory commit/push checkpoints. |
| [README.md](../README.md) | Entry page with running commands, learning links and release limits. |
| [package-lock.json](../package-lock.json) | Resolved npm dependency tree/integrities for repeatable installation; audit separately. |
| [package.json](../package.json) | npm workspace membership, supported Node version and shared check commands. |
| [playwright.config.ts](../playwright.config.ts) | Browser projects, local app servers, serial isolation and secret-conscious artifacts. |

## Application notes

| File | Why it exists |
|---|---|
| [apps/README.md](../apps/README.md) | Independent application setup, browser isolation and native limitations. |

## Staff application

| File | Why it exists |
|---|---|
| [apps/admin-dashboard/.env.example](../apps/admin-dashboard/.env.example) | Staff public app or server placeholder settings, never private credentials. |
| [apps/admin-dashboard/AGENTS.md](../apps/admin-dashboard/AGENTS.md) | Installed Next-version instructions requiring current local framework docs. |
| [apps/admin-dashboard/Dockerfile](../apps/admin-dashboard/Dockerfile) | Build and run the standalone staff server as non-root. |
| [apps/admin-dashboard/app/api/backend/[...path]/route.ts](../apps/admin-dashboard/app/api/backend/[...path]/route.ts) | Staff Next route adapter into the shared server session/proxy boundary. |
| [apps/admin-dashboard/app/api/session/route.ts](../apps/admin-dashboard/app/api/session/route.ts) | Staff Next route adapter into the shared server session/proxy boundary. |
| [apps/admin-dashboard/app/layout.tsx](../apps/admin-dashboard/app/layout.tsx) | Staff route entry for layout; delegates to its screen/providers. |
| [apps/admin-dashboard/app/page.tsx](../apps/admin-dashboard/app/page.tsx) | Staff route entry for page; delegates to its screen/providers. |
| [apps/admin-dashboard/app/styles.css](../apps/admin-dashboard/app/styles.css) | Staff route entry for styles; delegates to its screen/providers. |
| [apps/admin-dashboard/next.config.mjs](../apps/admin-dashboard/next.config.mjs) | Monorepo standalone output and browser security headers. |
| [apps/admin-dashboard/package.json](../apps/admin-dashboard/package.json) | Workspace dependencies, entry point and commands for apps\admin-dashboard. |
| [apps/admin-dashboard/src/client/AccountControls.tsx](../apps/admin-dashboard/src/client/AccountControls.tsx) | Staff interface for account controls; calls authorized APIs and handles pending/error state. |
| [apps/admin-dashboard/src/client/AdminApp.tsx](../apps/admin-dashboard/src/client/AdminApp.tsx) | Staff interface for admin app; calls authorized APIs and handles pending/error state. |
| [apps/admin-dashboard/src/client/BusinessControls.tsx](../apps/admin-dashboard/src/client/BusinessControls.tsx) | Staff interface for business controls; calls authorized APIs and handles pending/error state. |
| [apps/admin-dashboard/src/client/Reports.tsx](../apps/admin-dashboard/src/client/Reports.tsx) | Staff interface for reports; calls authorized APIs and handles pending/error state. |
| [apps/admin-dashboard/src/client/Reviews.tsx](../apps/admin-dashboard/src/client/Reviews.tsx) | Staff interface for reviews; calls authorized APIs and handles pending/error state. |
| [apps/admin-dashboard/src/client/StaffTools.tsx](../apps/admin-dashboard/src/client/StaffTools.tsx) | Staff interface for staff tools; calls authorized APIs and handles pending/error state. |
| [apps/admin-dashboard/src/client/Summary.tsx](../apps/admin-dashboard/src/client/Summary.tsx) | Staff interface for summary; calls authorized APIs and handles pending/error state. |
| [apps/admin-dashboard/src/client/VisitInspector.tsx](../apps/admin-dashboard/src/client/VisitInspector.tsx) | Staff interface for visit inspector; calls authorized APIs and handles pending/error state. |
| [apps/admin-dashboard/src/client/http.ts](../apps/admin-dashboard/src/client/http.ts) | Browser same-origin staff fetch, safe error parsing and session-expiry handling. |
| [apps/admin-dashboard/src/server/core.ts](../apps/admin-dashboard/src/server/core.ts) | Opaque staff sessions, Origin/route/body guards, trusted login identity and live server proxy. |
| [apps/admin-dashboard/src/server/runtime.ts](../apps/admin-dashboard/src/server/runtime.ts) | One bounded server registry across route bundles with explicit environment selection. |
| [apps/admin-dashboard/tests/session.test.ts](../apps/admin-dashboard/tests/session.test.ts) | Application regression checks for session. |
| [apps/admin-dashboard/tsconfig.json](../apps/admin-dashboard/tsconfig.json) | Staff strict application TypeScript settings. |

## Customer application

| File | Why it exists |
|---|---|
| [apps/customer-app/.env.example](../apps/customer-app/.env.example) | Customer public app or server placeholder settings, never private credentials. |
| [apps/customer-app/app.config.ts](../apps/customer-app/app.config.ts) | Customer separate app identity, public settings, native permissions/plugins and linking. |
| [apps/customer-app/app/_layout.tsx](../apps/customer-app/app/_layout.tsx) | Customer navigation/providers and app lifecycle assembly. |
| [apps/customer-app/app/account.tsx](../apps/customer-app/app/account.tsx) | Customer route entry for account; delegates to its screen/providers. |
| [apps/customer-app/app/index.tsx](../apps/customer-app/app/index.tsx) | Customer route entry for index; delegates to its screen/providers. |
| [apps/customer-app/app/reset-password.tsx](../apps/customer-app/app/reset-password.tsx) | Customer route entry for reset password; delegates to its screen/providers. |
| [apps/customer-app/app/vendor/[id].tsx](../apps/customer-app/app/vendor/[id].tsx) | Customer route entry for [id]; delegates to its screen/providers. |
| [apps/customer-app/app/verify-email.tsx](../apps/customer-app/app/verify-email.tsx) | Customer route entry for verify email; delegates to its screen/providers. |
| [apps/customer-app/app/visit/[id].tsx](../apps/customer-app/app/visit/[id].tsx) | Customer route entry for [id]; delegates to its screen/providers. |
| [apps/customer-app/app/visits.tsx](../apps/customer-app/app/visits.tsx) | Customer route entry for visits; delegates to its screen/providers. |
| [apps/customer-app/eas.json](../apps/customer-app/eas.json) | Customer development/preview/production build profiles without invented project credentials. |
| [apps/customer-app/package.json](../apps/customer-app/package.json) | Workspace dependencies, entry point and commands for apps\customer-app. |
| [apps/customer-app/src/components/AreaMap.tsx](../apps/customer-app/src/components/AreaMap.tsx) | Customer native map adapter with provider/configuration and privacy states. |
| [apps/customer-app/src/components/AreaMap.web.tsx](../apps/customer-app/src/components/AreaMap.web.tsx) | Customer Leaflet web map, attribution, disclosure and map teardown. |
| [apps/customer-app/src/components/map-types.ts](../apps/customer-app/src/components/map-types.ts) | Customer typed map marker/region inputs. |
| [apps/customer-app/src/copy.ts](../apps/customer-app/src/copy.ts) | Customer English/Tamil interface text dictionary. |
| [apps/customer-app/src/features/account/AccountScreen.tsx](../apps/customer-app/src/features/account/AccountScreen.tsx) | Customer interface for account; calls authorized APIs and handles pending/error state. |
| [apps/customer-app/src/features/auth/AuthScreen.tsx](../apps/customer-app/src/features/auth/AuthScreen.tsx) | Customer interface for auth; calls authorized APIs and handles pending/error state. |
| [apps/customer-app/src/features/auth/RecoveryLinks.tsx](../apps/customer-app/src/features/auth/RecoveryLinks.tsx) | Customer clear URL fragment and hand recovery tokens to the active screen. |
| [apps/customer-app/src/features/auth/RecoveryScreen.tsx](../apps/customer-app/src/features/auth/RecoveryScreen.tsx) | Customer interface for recovery; calls authorized APIs and handles pending/error state. |
| [apps/customer-app/src/features/auth/recovery-link.ts](../apps/customer-app/src/features/auth/recovery-link.ts) | Customer bounded fragment token parsing and query rejection. |
| [apps/customer-app/src/features/discovery/NearbyScreen.tsx](../apps/customer-app/src/features/discovery/NearbyScreen.tsx) | Customer interface for nearby; calls authorized APIs and handles pending/error state. |
| [apps/customer-app/src/features/discovery/meeting.tsx](../apps/customer-app/src/features/discovery/meeting.tsx) | Customer manual/GPS meeting-point selection and permission/accuracy states. |
| [apps/customer-app/src/features/vendors/VendorScreen.tsx](../apps/customer-app/src/features/vendors/VendorScreen.tsx) | Customer interface for vendor; calls authorized APIs and handles pending/error state. |
| [apps/customer-app/src/features/visits/VisitListScreen.tsx](../apps/customer-app/src/features/visits/VisitListScreen.tsx) | Customer interface for visit list; calls authorized APIs and handles pending/error state. |
| [apps/customer-app/src/features/visits/VisitScreen.tsx](../apps/customer-app/src/features/visits/VisitScreen.tsx) | Customer interface for visit; calls authorized APIs and handles pending/error state. |
| [apps/customer-app/src/features/visits/intent.ts](../apps/customer-app/src/features/visits/intent.ts) | Customer idempotent visit creation intent and payload-key continuity. |
| [apps/customer-app/src/language.tsx](../apps/customer-app/src/language.tsx) | Customer saved English/Tamil preference and translated rendering context. |
| [apps/customer-app/src/notifications.tsx](../apps/customer-app/src/notifications.tsx) | Customer opt-in notification permission/registration, resume and authorized tap adapter. |
| [apps/customer-app/src/session.tsx](../apps/customer-app/src/session.tsx) | Customer account/session provider, foreground refresh and sign-out cache cleanup. |
| [apps/customer-app/src/ui.tsx](../apps/customer-app/src/ui.tsx) | Customer shared local screen, form, button and accessible text primitives. |
| [apps/customer-app/src/web-assets.d.ts](../apps/customer-app/src/web-assets.d.ts) | Customer web asset module declarations. |
| [apps/customer-app/tests/copy.test.ts](../apps/customer-app/tests/copy.test.ts) | Application regression checks for copy. |
| [apps/customer-app/tests/discovery-freshness.test.ts](../apps/customer-app/tests/discovery-freshness.test.ts) | Application regression checks for discovery freshness. |
| [apps/customer-app/tests/recovery-link.test.ts](../apps/customer-app/tests/recovery-link.test.ts) | Application regression checks for recovery link. |
| [apps/customer-app/tests/visit-intent.test.ts](../apps/customer-app/tests/visit-intent.test.ts) | Application regression checks for visit intent. |
| [apps/customer-app/tsconfig.json](../apps/customer-app/tsconfig.json) | Customer strict application TypeScript settings. |

## Partner application

| File | Why it exists |
|---|---|
| [apps/vendor-app/.env.example](../apps/vendor-app/.env.example) | Partner public app or server placeholder settings, never private credentials. |
| [apps/vendor-app/app.config.ts](../apps/vendor-app/app.config.ts) | Partner separate app identity, public settings, native permissions/plugins and linking. |
| [apps/vendor-app/app/_layout.tsx](../apps/vendor-app/app/_layout.tsx) | Partner navigation/providers and app lifecycle assembly. |
| [apps/vendor-app/app/account.tsx](../apps/vendor-app/app/account.tsx) | Partner route entry for account; delegates to its screen/providers. |
| [apps/vendor-app/app/index.tsx](../apps/vendor-app/app/index.tsx) | Partner route entry for index; delegates to its screen/providers. |
| [apps/vendor-app/app/profile.tsx](../apps/vendor-app/app/profile.tsx) | Partner route entry for profile; delegates to its screen/providers. |
| [apps/vendor-app/app/reset-password.tsx](../apps/vendor-app/app/reset-password.tsx) | Partner route entry for reset password; delegates to its screen/providers. |
| [apps/vendor-app/app/verify-email.tsx](../apps/vendor-app/app/verify-email.tsx) | Partner route entry for verify email; delegates to its screen/providers. |
| [apps/vendor-app/app/visit/[id].tsx](../apps/vendor-app/app/visit/[id].tsx) | Partner route entry for [id]; delegates to its screen/providers. |
| [apps/vendor-app/app/visits.tsx](../apps/vendor-app/app/visits.tsx) | Partner route entry for visits; delegates to its screen/providers. |
| [apps/vendor-app/eas.json](../apps/vendor-app/eas.json) | Partner development/preview/production build profiles without invented project credentials. |
| [apps/vendor-app/package.json](../apps/vendor-app/package.json) | Workspace dependencies, entry point and commands for apps\vendor-app. |
| [apps/vendor-app/src/auth-store.ts](../apps/vendor-app/src/auth-store.ts) | Partner token persistence coordinated with headless/background session generation. |
| [apps/vendor-app/src/copy.ts](../apps/vendor-app/src/copy.ts) | Partner English/Tamil interface text dictionary. |
| [apps/vendor-app/src/features/account/AccountScreen.tsx](../apps/vendor-app/src/features/account/AccountScreen.tsx) | Partner interface for account; calls authorized APIs and handles pending/error state. |
| [apps/vendor-app/src/features/auth/AuthScreen.tsx](../apps/vendor-app/src/features/auth/AuthScreen.tsx) | Partner interface for auth; calls authorized APIs and handles pending/error state. |
| [apps/vendor-app/src/features/auth/RecoveryLinks.tsx](../apps/vendor-app/src/features/auth/RecoveryLinks.tsx) | Partner clear URL fragment and hand recovery tokens to the active screen. |
| [apps/vendor-app/src/features/auth/RecoveryScreen.tsx](../apps/vendor-app/src/features/auth/RecoveryScreen.tsx) | Partner interface for recovery; calls authorized APIs and handles pending/error state. |
| [apps/vendor-app/src/features/auth/recovery-link.ts](../apps/vendor-app/src/features/auth/recovery-link.ts) | Partner bounded fragment token parsing and query rejection. |
| [apps/vendor-app/src/features/dashboard/DashboardScreen.tsx](../apps/vendor-app/src/features/dashboard/DashboardScreen.tsx) | Partner interface for dashboard; calls authorized APIs and handles pending/error state. |
| [apps/vendor-app/src/features/profile/ProfileScreen.tsx](../apps/vendor-app/src/features/profile/ProfileScreen.tsx) | Partner interface for profile; calls authorized APIs and handles pending/error state. |
| [apps/vendor-app/src/features/profile/queries.ts](../apps/vendor-app/src/features/profile/queries.ts) | Partner business profile/category query wiring and safe invalidation. |
| [apps/vendor-app/src/features/visits/VisitListScreen.tsx](../apps/vendor-app/src/features/visits/VisitListScreen.tsx) | Partner interface for visit list; calls authorized APIs and handles pending/error state. |
| [apps/vendor-app/src/features/visits/VisitScreen.tsx](../apps/vendor-app/src/features/visits/VisitScreen.tsx) | Partner interface for visit; calls authorized APIs and handles pending/error state. |
| [apps/vendor-app/src/language.tsx](../apps/vendor-app/src/language.tsx) | Partner saved English/Tamil preference and translated rendering context. |
| [apps/vendor-app/src/location/background-policy.ts](../apps/vendor-app/src/location/background-policy.ts) | Pure eligibility rules for background samples and authority lifetime. |
| [apps/vendor-app/src/location/background.ts](../apps/vendor-app/src/location/background.ts) | Module-scope native task; bounded token use, consent/nonce checks and latest fix only. |
| [apps/vendor-app/src/location/controller.ts](../apps/vendor-app/src/location/controller.ts) | Serialized sharing start/stop and generation guards, including offline confirmation. |
| [apps/vendor-app/src/location/lifecycle.ts](../apps/vendor-app/src/location/lifecycle.ts) | Coordinate account/session/sharing lifecycle without overlapping stale work. |
| [apps/vendor-app/src/location/provider.tsx](../apps/vendor-app/src/location/provider.tsx) | Wire foreground Location, permission and controller state into React. |
| [apps/vendor-app/src/location/resume.ts](../apps/vendor-app/src/location/resume.ts) | Reconcile live account/business/consent before restoring resumed sharing. |
| [apps/vendor-app/src/notifications.tsx](../apps/vendor-app/src/notifications.tsx) | Partner opt-in notification permission/registration, resume and authorized tap adapter. |
| [apps/vendor-app/src/session.tsx](../apps/vendor-app/src/session.tsx) | Partner account/session provider, foreground refresh and sign-out cache cleanup. |
| [apps/vendor-app/src/ui.tsx](../apps/vendor-app/src/ui.tsx) | Partner shared local screen, form, button and accessible text primitives. |
| [apps/vendor-app/tests/background.test.ts](../apps/vendor-app/tests/background.test.ts) | Application regression checks for background. |
| [apps/vendor-app/tests/language.test.ts](../apps/vendor-app/tests/language.test.ts) | Application regression checks for language. |
| [apps/vendor-app/tests/recovery-link.test.ts](../apps/vendor-app/tests/recovery-link.test.ts) | Application regression checks for recovery link. |
| [apps/vendor-app/tests/resume.test.ts](../apps/vendor-app/tests/resume.test.ts) | Application regression checks for resume. |
| [apps/vendor-app/tests/sharing.test.ts](../apps/vendor-app/tests/sharing.test.ts) | Application regression checks for sharing. |
| [apps/vendor-app/tsconfig.json](../apps/vendor-app/tsconfig.json) | Partner strict application TypeScript settings. |

## Backend source and migrations

| File | Why it exists |
|---|---|
| [backend/.dockerignore](../backend/.dockerignore) | Keeps private/generated backend state out of image context. |
| [backend/Dockerfile](../backend/Dockerfile) | Non-root API image with distinct production and development targets. |
| [backend/alembic.ini](../backend/alembic.ini) | Alembic migration configuration without embedded database credentials. |
| [backend/app/__init__.py](../backend/app/__init__.py) | Python package boundary. |
| [backend/app/admin/__init__.py](../backend/app/admin/__init__.py) | Python package boundary. |
| [backend/app/admin/router.py](../backend/app/admin/router.py) | Admin HTTP endpoints with input, actor and database dependencies. |
| [backend/app/admin/schemas.py](../backend/app/admin/schemas.py) | Admin request/response fields, bounds and forbidden-extra-field contracts. |
| [backend/app/admin/service.py](../backend/app/admin/service.py) | Audited business review/suspension/reinstatement/account decisions. |
| [backend/app/admin/summary.py](../backend/app/admin/summary.py) | Role-scoped operational and partner daily visit counts. |
| [backend/app/auth/__init__.py](../backend/app/auth/__init__.py) | Python package boundary. |
| [backend/app/auth/dependencies.py](../backend/app/auth/dependencies.py) | Resolve live authenticated actor/session and enforce fixed route roles. |
| [backend/app/auth/mailer.py](../backend/app/auth/mailer.py) | Configured SMTP transport and safe unavailable/failure behavior. |
| [backend/app/auth/recovery.py](../backend/app/auth/recovery.py) | One-use hashed reset/verification tokens, delivery and confirmation transactions. |
| [backend/app/auth/router.py](../backend/app/auth/router.py) | Auth HTTP endpoints with input, actor and database dependencies. |
| [backend/app/auth/schemas.py](../backend/app/auth/schemas.py) | Auth request/response fields, bounds and forbidden-extra-field contracts. |
| [backend/app/auth/security.py](../backend/app/auth/security.py) | Password hashing, JWT validation/signing, token digests and UTC clock helpers. |
| [backend/app/auth/service.py](../backend/app/auth/service.py) | Atomic abuse counters, account locks, login/rotation/logout and account privacy writes. |
| [backend/app/cli.py](../backend/app/cli.py) | Interactive staff account creation and idempotent category seeding. |
| [backend/app/config.py](../backend/app/config.py) | Typed settings, database URL and production safety validation. |
| [backend/app/database.py](../backend/app/database.py) | SQLAlchemy base, bounded connection pool and request-session lifecycle. |
| [backend/app/errors.py](../backend/app/errors.py) | Safe business/validation errors and server request-ID integration. |
| [backend/app/health.py](../backend/app/health.py) | Real PostgreSQL/PostGIS readiness queries and safe 200/503 bodies. |
| [backend/app/jobs.py](../backend/app/jobs.py) | Bounded expiry, retention, stale-GPS erasure and periodic notification dispatch. |
| [backend/app/location/__init__.py](../backend/app/location/__init__.py) | Python package boundary. |
| [backend/app/location/router.py](../backend/app/location/router.py) | Location HTTP endpoints with input, actor and database dependencies. |
| [backend/app/location/schemas.py](../backend/app/location/schemas.py) | Location request/response fields, bounds and forbidden-extra-field contracts. |
| [backend/app/location/service.py](../backend/app/location/service.py) | Latest-fix write flow, coarse PostGIS discovery, signed cursors and origin limits. |
| [backend/app/location/validation.py](../backend/app/location/validation.py) | Freshness/future bounds and production fail-closed service-area validation. |
| [backend/app/main.py](../backend/app/main.py) | Application factory, route assembly, lifespan, listener/jobs startup and shutdown cleanup. |
| [backend/app/models/__init__.py](../backend/app/models/__init__.py) | Python package boundary and explicit model imports for Alembic. |
| [backend/app/models/accounts.py](../backend/app/models/accounts.py) | SQLAlchemy table definitions, constraints and indexes for accounts. |
| [backend/app/models/locations.py](../backend/app/models/locations.py) | SQLAlchemy table definitions, constraints and indexes for locations. |
| [backend/app/models/mail_tokens.py](../backend/app/models/mail_tokens.py) | SQLAlchemy table definitions, constraints and indexes for mail tokens. |
| [backend/app/models/notifications.py](../backend/app/models/notifications.py) | SQLAlchemy table definitions, constraints and indexes for notifications. |
| [backend/app/models/reports.py](../backend/app/models/reports.py) | SQLAlchemy table definitions, constraints and indexes for reports. |
| [backend/app/models/vendors.py](../backend/app/models/vendors.py) | SQLAlchemy table definitions, constraints and indexes for vendors. |
| [backend/app/models/visits.py](../backend/app/models/visits.py) | SQLAlchemy table definitions, constraints and indexes for visits. |
| [backend/app/notifications/__init__.py](../backend/app/notifications/__init__.py) | Python package boundary. |
| [backend/app/notifications/dispatcher.py](../backend/app/notifications/dispatcher.py) | Bounded leases, provider I/O outside locks, retries and guarded receipts. |
| [backend/app/notifications/provider.py](../backend/app/notifications/provider.py) | Expo send/receipt HTTP adapter and safe provider errors. |
| [backend/app/notifications/router.py](../backend/app/notifications/router.py) | Notifications HTTP endpoints with input, actor and database dependencies. |
| [backend/app/notifications/schemas.py](../backend/app/notifications/schemas.py) | Notifications request/response fields, bounds and forbidden-extra-field contracts. |
| [backend/app/notifications/service.py](../backend/app/notifications/service.py) | Session/project-bound device ownership and transactional per-device job enqueueing. |
| [backend/app/observability.py](../backend/app/observability.py) | Request IDs, safe database/unexpected-error handling and metadata-only JSON logs. |
| [backend/app/realtime/__init__.py](../backend/app/realtime/__init__.py) | Python package boundary. |
| [backend/app/realtime/manager.py](../backend/app/realtime/manager.py) | Bounded connection ownership, subscriptions, listener and queued ID hints. |
| [backend/app/realtime/read.py](../backend/app/realtime/read.py) | Resolve current authorized socket events from fresh database state. |
| [backend/app/realtime/router.py](../backend/app/realtime/router.py) | Socket authentication, receive/send/watch loops and disconnect cleanup. |
| [backend/app/realtime/schemas.py](../backend/app/realtime/schemas.py) | Realtime request/response fields, bounds and forbidden-extra-field contracts. |
| [backend/app/realtime/signals.py](../backend/app/realtime/signals.py) | Transactional PostgreSQL ID-only notifications, delivered after commit. |
| [backend/app/users/__init__.py](../backend/app/users/__init__.py) | Python package boundary. |
| [backend/app/users/router.py](../backend/app/users/router.py) | Users HTTP endpoints with input, actor and database dependencies. |
| [backend/app/users/schemas.py](../backend/app/users/schemas.py) | Users request/response fields, bounds and forbidden-extra-field contracts. |
| [backend/app/vendors/__init__.py](../backend/app/vendors/__init__.py) | Python package boundary. |
| [backend/app/vendors/router.py](../backend/app/vendors/router.py) | Vendors HTTP endpoints with input, actor and database dependencies. |
| [backend/app/vendors/schemas.py](../backend/app/vendors/schemas.py) | Vendors request/response fields, bounds and forbidden-extra-field contracts. |
| [backend/app/vendors/service.py](../backend/app/vendors/service.py) | Business/category persistence, account/vendor locks, online consent and exact-point erasure. |
| [backend/app/visits/__init__.py](../backend/app/visits/__init__.py) | Python package boundary. |
| [backend/app/visits/arrival.py](../backend/app/visits/arrival.py) | Two-fix timing/accuracy/PostGIS distance confirmation with transient debounce. |
| [backend/app/visits/privacy.py](../backend/app/visits/privacy.py) | Cancel active work and erase affected meeting points during account deletion. |
| [backend/app/visits/reports.py](../backend/app/visits/reports.py) | Participant issue creation, staff resolution and audited support actions. |
| [backend/app/visits/router.py](../backend/app/visits/router.py) | Visits HTTP endpoints with input, actor and database dependencies. |
| [backend/app/visits/schemas.py](../backend/app/visits/schemas.py) | Visits request/response fields, bounds and forbidden-extra-field contracts. |
| [backend/app/visits/service.py](../backend/app/visits/service.py) | Idempotent creation, participant reads, expiry and transactional versioned transitions. |
| [backend/app/visits/state.py](../backend/app/visits/state.py) | Canonical active/terminal/trackable states and actor action matrix. |
| [backend/app/visits/tracking.py](../backend/app/visits/tracking.py) | Customer-only fresh exact tracking with current joined eligibility checks. |
| [backend/migrations/env.py](../backend/migrations/env.py) | Connects Alembic to configured metadata and restricts comparison to application schema. |
| [backend/migrations/script.py.mako](../backend/migrations/script.py.mako) | Template for a new explicit Alembic revision. |
| [backend/migrations/versions/0001_enable_postgis.py](../backend/migrations/versions/0001_enable_postgis.py) | Explicit versioned schema migration: 0001 enable postgis; preserve published history. |
| [backend/migrations/versions/0002_accounts.py](../backend/migrations/versions/0002_accounts.py) | Explicit versioned schema migration: 0002 accounts; preserve published history. |
| [backend/migrations/versions/0003_mail_tokens.py](../backend/migrations/versions/0003_mail_tokens.py) | Explicit versioned schema migration: 0003 mail tokens; preserve published history. |
| [backend/migrations/versions/0004_vendors_locations.py](../backend/migrations/versions/0004_vendors_locations.py) | Explicit versioned schema migration: 0004 vendors locations; preserve published history. |
| [backend/migrations/versions/0005_visits_reports.py](../backend/migrations/versions/0005_visits_reports.py) | Explicit versioned schema migration: 0005 visits reports; preserve published history. |
| [backend/migrations/versions/0006_notifications.py](../backend/migrations/versions/0006_notifications.py) | Explicit versioned schema migration: 0006 notifications; preserve published history. |
| [backend/pyproject.toml](../backend/pyproject.toml) | Python dependencies/package metadata and pytest discovery settings. |
| [backend/requirements.lock](../backend/requirements.lock) | Resolved Python version constraints used for installation. |
| [backend/scripts/browser_fixture.py](../backend/scripts/browser_fixture.py) | Guarded synthetic browser accounts/fixtures and per-case isolation; refuses real DB. |
| [backend/scripts/demo_workflow.py](../backend/scripts/demo_workflow.py) | Repeat the maintained synthetic HTTP/PostgreSQL visit test without development demo rows. |
| [backend/scripts/run_browser_tests.py](../backend/scripts/run_browser_tests.py) | Disposable browser database/API startup, migration/seed, child checks and cleanup. |
| [backend/scripts/simulate_gps.py](../backend/scripts/simulate_gps.py) | Guarded synthetic movement updates and cleanup for local location exercises. |

## Backend tests

| File | Why it exists |
|---|---|
| [backend/tests/conftest.py](../backend/tests/conftest.py) | Isolated test setup, synthetic fixtures and shared cleanup/authorization helpers. |
| [backend/tests/test_account_recovery.py](../backend/tests/test_account_recovery.py) | Regression coverage: recovery does not disclose account existence; password reset is one use and revokes existing sessions; email confirmation is one use. |
| [backend/tests/test_admin.py](../backend/tests/test_admin.py) | Regression coverage: only operator can review and queue is bounded; review and suspension are audited and hide location; suspended account loses existing session. |
| [backend/tests/test_admin_recovery.py](../backend/tests/test_admin_recovery.py) | Regression coverage: reinstatement requires staff and returns pending without location; staff can suspend business of inactive owner without losing own session; inactive review target is conflict and deleted target leaves queue. |
| [backend/tests/test_arrival.py](../backend/tests/test_arrival.py) | Regression coverage: two separated accurate fixes arrive then complete without recording sale; poor or outside fix resets arrival candidate; batched future timestamps do not satisfy server elapsed time. |
| [backend/tests/test_auth.py](../backend/tests/test_auth.py) | Regression coverage: registration fixes role and hashes password; registration does not accept admin role or unknown fields; duplicate normalized email conflicts. |
| [backend/tests/test_backup_restore.py](../backend/tests/test_backup_restore.py) | Regression coverage: restore refuses missing backup before contacting docker; restore rejects unsafe target before database commands; invalid dump does not create restore database. |
| [backend/tests/test_config.py](../backend/tests/test_config.py) | Regression coverage: database url handles password characters; missing password fails without connecting; empty password is rejected. |
| [backend/tests/test_cors.py](../backend/tests/test_cors.py) | Regression coverage: browser app can preflight authenticated json writes; unlisted browser origin cannot read api responses. |
| [backend/tests/test_database.py](../backend/tests/test_database.py) | Regression coverage: clean database migrates to head and repeated upgrade is safe; postgis uses metres and health queries real database; baseline downgrade preserves postgis and schema check is clean. |
| [backend/tests/test_devices.py](../backend/tests/test_devices.py) | Regression coverage: device registration is role bound and never returns push address; ownership transfer deletes old delivery records and blocks old owner; logout disables only its family and logout all disables remaining devices. |
| [backend/tests/test_discovery.py](../backend/tests/test_discovery.py) | Regression coverage: nearby is customer only and exposes coarse regions; search bounds are enforced; database filters unavailable vendors. |
| [backend/tests/test_end_to_end.py](../backend/tests/test_end_to_end.py) | Regression coverage: customer partner visit with isolation and notification; binary backup restores real business and visit rows. |
| [backend/tests/test_expo_provider.py](../backend/tests/test_expo_provider.py) | Regression coverage: provider is disabled without credentials and never calls transport; expo adapter validates ticket shape and keeps credentials in headers. |
| [backend/tests/test_health.py](../backend/tests/test_health.py) | Regression coverage: health reports database and postgis ready; health reports database failure without leaking details; health distinguishes missing postgis without leaking details. |
| [backend/tests/test_lifespan.py](../backend/tests/test_lifespan.py) | Regression coverage: failed background worker cannot skip pool disposal. |
| [backend/tests/test_location_privacy.py](../backend/tests/test_location_privacy.py) | Regression coverage: small search changes and within cell motion cannot refine public point. |
| [backend/tests/test_locations.py](../backend/tests/test_locations.py) | Regression coverage: monotonic updates and only latest fix is kept; invalid updates do not replace good point; nonfinite input is a safe validation error. |
| [backend/tests/test_notification_receipts.py](../backend/tests/test_notification_receipts.py) | Regression coverage: receipt success records provider acceptance; unregistered token is retired on permanent provider error; missing receipt retries without resending notification. |
| [backend/tests/test_notification_retention.py](../backend/tests/test_notification_retention.py) | Regression coverage: disabled provider cannot retain pending payload indefinitely; stale device address is purged after thirty days; disabled provider cannot retain unfinished receipts indefinitely. |
| [backend/tests/test_outbox.py](../backend/tests/test_outbox.py) | Regression coverage: outbox is per event device and has no coordinates; outbox failure rolls back business state and event; provider acceptance is ticketed and external payload is minimal. |
| [backend/tests/test_password_policy.py](../backend/tests/test_password_policy.py) | Regression coverage: password shorter than fifteen characters is rejected; password spaces and unicode are preserved; invalid unicode password is a validation error. |
| [backend/tests/test_production_compose.py](../backend/tests/test_production_compose.py) | Regression coverage: production model keeps database and apps private; only reserved proxy addresses are trusted and dynamic ips cannot collide; production model refuses missing owner settings. |
| [backend/tests/test_production_config.py](../backend/tests/test_production_config.py) | Regression coverage: production refuses incomplete or unsafe configuration; complete production configuration can be constructed without network; production fixture is independent of development mail environment. |
| [backend/tests/test_retention.py](../backend/tests/test_retention.py) | Regression coverage: retention physically erases abandoned fixes only after freshness window; retention skips a location writer and preserves its fresh replacement; retention redacts terminal points and preserves active work. |
| [backend/tests/test_service_area.py](../backend/tests/test_service_area.py) | Regression coverage: service area configuration rejects bad geometry format; production polygon controls real postgis updates; invalid polygon is a safe configuration error. |
| [backend/tests/test_simulator.py](../backend/tests/test_simulator.py) | Regression coverage: simulator rejects a route that outlives its access token; simulator uses protected routes and stops after success or error. |
| [backend/tests/test_users.py](../backend/tests/test_users.py) | Regression coverage: own profile updates only allowed fields; account deletion revokes access and requires confirmation. |
| [backend/tests/test_vendor_logout.py](../backend/tests/test_vendor_logout.py) | Regression coverage: vendor logout erases location and revokes active visit tracking. |
| [backend/tests/test_vendors.py](../backend/tests/test_vendors.py) | Regression coverage: categories require auth and seed is idempotent; vendor owns profile and cannot self approve; profile pending and public view omits identity. |
| [backend/tests/test_visit_concurrency.py](../backend/tests/test_visit_concurrency.py) | Regression coverage: concurrent accept cancel has one winner; concurrent creation retries make one request and event; expiry racing acceptance cannot create two terminal events. |
| [backend/tests/test_visits.py](../backend/tests/test_visits.py) | Regression coverage: creation idempotency pair uniqueness and event privacy; request payload and creation permissions; tracking is private before acceptance and revoked at termination. |
| [backend/tests/test_websocket_auth.py](../backend/tests/test_websocket_auth.py) | Regression coverage: socket requires bounded initial authentication; auth deadline and oversized first frame close without private data; query tokens and untrusted browser origins are rejected. |
| [backend/tests/test_websocket_events.py](../backend/tests/test_websocket_events.py) | Regression coverage: inbox event is committed versioned and isolated from other customer; precise subscription ends at terminal state and cannot be reopened; reconnect requires rest resync and never replays old precise location. |
| [backend/tests/test_websocket_network.py](../backend/tests/test_websocket_network.py) | Regression coverage: native two client isolation and committed event delivery. |

## Reading and historical artifacts

| File | Why it exists |
|---|---|
| [docs/ADMIN_APP.md](../docs/ADMIN_APP.md) | Maintained reading/reference document: Administration application. |
| [docs/API.md](../docs/API.md) | Maintained reading/reference document: Current API contracts. |
| [docs/API_CLIENT.md](../docs/API_CLIENT.md) | Maintained reading/reference document: Shared application client. |
| [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | Maintained reading/reference document: Current architecture. |
| [docs/AUTHENTICATION.md](../docs/AUTHENTICATION.md) | Maintained reading/reference document: Authentication and accounts. |
| [docs/BACKUPS.md](../docs/BACKUPS.md) | Maintained reading/reference document: Backups and isolated restore checks. |
| [docs/DATABASE.md](../docs/DATABASE.md) | Maintained reading/reference document: Current database. |
| [docs/DEBUGGING.md](../docs/DEBUGGING.md) | Maintained reading/reference document: Debugging independently. |
| [docs/DEPENDENCIES.md](../docs/DEPENDENCIES.md) | Maintained reading/reference document: Dependency review — 4 November 2026. |
| [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) | Maintained reading/reference document: Windows development and deployment. |
| [docs/UX_RESEARCH_AND_CODE_MAP.md](../docs/UX_RESEARCH_AND_CODE_MAP.md) | Reference-app evidence, usability reasons, module responsibilities and acceptance checks for the proposed redesign. |
| [CLAUDE.md](../CLAUDE.md) | Approved UI design guidance for coding tools. |
| [DESIGN.md](../DESIGN.md) | Approved simpler Customer and Vendor workflows, typography and provisional colours. |
| [docs/superpowers/plans/2026-11-05-simple-mobile-ui.md](../docs/superpowers/plans/2026-11-05-simple-mobile-ui.md) | Implementation checkpoints and verification for the approved mobile redesign. |
| [docs/DESIGN.md](../docs/DESIGN.md) | Maintained reading/reference document: MyStreetVendor interface design. |
| [docs/FILE_GUIDE.md](../docs/FILE_GUIDE.md) | Maintained reading/reference document: Every file and how the foundation works. |
| [docs/FOUNDATION_HANDBOOK.md](../docs/FOUNDATION_HANDBOOK.md) | Maintained reading/reference document: MyStreetVendor Foundation Handbook. |
| [docs/IMPLEMENTATION_STATUS.md](../docs/IMPLEMENTATION_STATUS.md) | Maintained reading/reference document: Current implementation status. |
| [docs/LOCAL_VERIFICATION.md](../docs/LOCAL_VERIFICATION.md) | Maintained reading/reference document: Local verification — 4 November 2026. |
| [docs/LOCATION.md](../docs/LOCATION.md) | Maintained reading/reference document: Location updates and nearby discovery. |
| [docs/MOBILE_MAPS.md](../docs/MOBILE_MAPS.md) | Maintained reading/reference document: Customer maps. |
| [docs/MOBILE_RECOVERY.md](../docs/MOBILE_RECOVERY.md) | Maintained reading/reference document: Customer and Partner recovery links. |
| [docs/NOTIFICATIONS.md](../docs/NOTIFICATIONS.md) | Maintained reading/reference document: Notification delivery. |
| [docs/PARTNER_APP.md](../docs/PARTNER_APP.md) | Maintained reading/reference document: Partner application. |
| [docs/PRODUCTION.md](../docs/PRODUCTION.md) | Maintained reading/reference document: Self-hosted production package. |
| [docs/PROJECT_HANDBOOK.md](../docs/PROJECT_HANDBOOK.md) | Maintained reading/reference document: MyStreetVendor project handbook. |
| [docs/REALTIME.md](../docs/REALTIME.md) | Maintained reading/reference document: Authenticated realtime delivery. |
| [docs/ROADMAP.md](../docs/ROADMAP.md) | Maintained reading/reference document: Delivery status and next work. |
| [docs/SECURITY.md](../docs/SECURITY.md) | Maintained reading/reference document: Security and privacy. |
| [docs/VENDORS.md](../docs/VENDORS.md) | Maintained reading/reference document: Vendor profiles and staff review. |
| [docs/VERIFICATION.md](../docs/VERIFICATION.md) | Maintained reading/reference document: Phase 0 and Phase 1 verification. |
| [docs/VISITS.md](../docs/VISITS.md) | Maintained reading/reference document: Visit requests, privacy and maintenance. |
| [docs/superpowers/plans/2026-11-02-applications.md](../docs/superpowers/plans/2026-11-02-applications.md) | Dated approved design or implementation plan: MyStreetVendor applications implementation plan; current evidence is separate. |
| [docs/superpowers/plans/2026-11-02-backend-mvp.md](../docs/superpowers/plans/2026-11-02-backend-mvp.md) | Dated approved design or implementation plan: MyStreetVendor backend MVP implementation plan; current evidence is separate. |
| [docs/superpowers/plans/2026-11-02-complete-mvp.md](../docs/superpowers/plans/2026-11-02-complete-mvp.md) | Dated approved design or implementation plan: MyStreetVendor complete MVP implementation plan; current evidence is separate. |
| [docs/superpowers/plans/2026-11-02-operations.md](../docs/superpowers/plans/2026-11-02-operations.md) | Dated approved design or implementation plan: MyStreetVendor operations and verification implementation plan; current evidence is separate. |
| [docs/superpowers/specs/2026-11-02-complete-mvp-design.md](../docs/superpowers/specs/2026-11-02-complete-mvp-design.md) | Dated approved design or implementation plan: MyStreetVendor complete MVP design; current evidence is separate. |
| [output/pdf/MyStreetVendor_Foundation_Handbook.pdf](../output/pdf/MyStreetVendor_Foundation_Handbook.pdf) | Historical printable October foundation edition; current MVP handbook is Markdown. |

## Operations

| File | Why it exists |
|---|---|
| [infrastructure/.env.production.example](../infrastructure/.env.production.example) | Placeholder owner-controlled production domains/secrets/provider/polygon settings. |
| [infrastructure/Caddyfile](../infrastructure/Caddyfile) | Public production routes, body/security limits, identity overwrite and privacy-aware logging. |
| [infrastructure/compose.production.yaml](../infrastructure/compose.production.yaml) | Private runtime/migration roles, hardened images, Caddy and reserved proxy networking. |
| [infrastructure/compose.yaml](../infrastructure/compose.yaml) | Loopback development API, PostGIS volume and local Mailpit services. |
| [infrastructure/scripts/Backup-Database.ps1](../infrastructure/scripts/Backup-Database.ps1) | Windows operator wrapper; binary dump copied as a file with size/digest metadata. |
| [infrastructure/scripts/Test-Production.ps1](../infrastructure/scripts/Test-Production.ps1) | Disposable production rehearsal, private HTTP proxy override, restart/backup checks and cleanup. |
| [infrastructure/scripts/Test-Restore.ps1](../infrastructure/scripts/Test-Restore.ps1) | Validate input/copy archive, invoke isolated restore and clean generated temporary files. |
| [infrastructure/scripts/Test-Stack.ps1](../infrastructure/scripts/Test-Stack.ps1) | Repeat backend, app/type/build, optional browser/production/native-export checks. |
| [infrastructure/scripts/backup.sh](../infrastructure/scripts/backup.sh) | Linux pg_dump custom archive with restrictive permissions and guarded temporary name. |
| [infrastructure/scripts/bootstrap-roles.sh](../infrastructure/scripts/bootstrap-roles.sh) | First-volume role/password grants, extension and application-schema ownership. |
| [infrastructure/scripts/check_production.py](../infrastructure/scripts/check_production.py) | Guarded synthetic real-role/API/admin/Caddy and spoofed-IP protocol checks. |
| [infrastructure/scripts/migrate.sh](../infrastructure/scripts/migrate.sh) | Explicit restricted-migrator Alembic run and runtime revision-read grants. |
| [infrastructure/scripts/restore-check.sh](../infrastructure/scripts/restore-check.sh) | New generated restore DB, transactional restore, schema/row checks and trap cleanup. |

## Shared packages

| File | Why it exists |
|---|---|
| [packages/api-client/package.json](../packages/api-client/package.json) | Workspace dependencies, entry point and commands for packages\api-client. |
| [packages/api-client/src/devices.ts](../packages/api-client/src/devices.ts) | Installation registration, permission/project checks and authorized notification tap handling. |
| [packages/api-client/src/index.ts](../packages/api-client/src/index.ts) | Typed HTTP errors, bound fetch, coordinated refresh and generation-aware session authority. |
| [packages/api-client/src/realtime.ts](../packages/api-client/src/realtime.ts) | Bounded socket transport, reconnect/authentication and validated event delivery. |
| [packages/api-client/src/storage.ts](../packages/api-client/src/storage.ts) | Independent native SecureStore/browser-memory token storage policy. |
| [packages/api-client/tests/devices.test.ts](../packages/api-client/tests/devices.test.ts) | Application regression checks for devices. |
| [packages/api-client/tests/events.test.ts](../packages/api-client/tests/events.test.ts) | Application regression checks for events. |
| [packages/api-client/tests/headless.test.ts](../packages/api-client/tests/headless.test.ts) | Application regression checks for headless. |
| [packages/api-client/tests/realtime.test.ts](../packages/api-client/tests/realtime.test.ts) | Application regression checks for realtime. |
| [packages/api-client/tests/session.test.ts](../packages/api-client/tests/session.test.ts) | Application regression checks for session. |
| [packages/api-client/tests/storage.test.ts](../packages/api-client/tests/storage.test.ts) | Application regression checks for storage. |
| [packages/design-tokens/check-contrast.mjs](../packages/design-tokens/check-contrast.mjs) | Compute seven text contrast pairs and minimum touch-size assertions. |
| [packages/design-tokens/index.ts](../packages/design-tokens/index.ts) | Typed export of shared visual tokens. |
| [packages/design-tokens/package.json](../packages/design-tokens/package.json) | Workspace dependencies, entry point and commands for packages\design-tokens. |
| [packages/design-tokens/tokens.json](../packages/design-tokens/tokens.json) | Shared palette, spacing, type and minimum touch dimensions. |
| [packages/shared-types/package.json](../packages/shared-types/package.json) | Workspace dependencies, entry point and commands for packages\shared-types. |
| [packages/shared-types/src/index.ts](../packages/shared-types/src/index.ts) | Strict Zod input/response/event contracts and shared TypeScript types. |
| [packages/tsconfig.json](../packages/tsconfig.json) | Strict shared-package TypeScript checking. |

## Browser checks and runners

| File | Why it exists |
|---|---|
| [scripts/Invoke-UiChecks.ps1](../scripts/Invoke-UiChecks.ps1) | PowerShell local check entry point for invoke  ui checks. |
| [scripts/Test-Applications.ps1](../scripts/Test-Applications.ps1) | PowerShell local check entry point for test  applications. |
| [scripts/Test-LocalMail.ps1](../scripts/Test-LocalMail.ps1) | PowerShell local check entry point for test  local mail. |
| [scripts/Test-VisitWorkflow.ps1](../scripts/Test-VisitWorkflow.ps1) | PowerShell local check entry point for test  visit workflow. |
| [tests/e2e/admin-auth.test.ts](../tests/e2e/admin-auth.test.ts) | Application regression checks for admin auth. |
| [tests/e2e/admin-reviews.test.ts](../tests/e2e/admin-reviews.test.ts) | Application regression checks for admin reviews. |
| [tests/e2e/admin-support.test.ts](../tests/e2e/admin-support.test.ts) | Application regression checks for admin support. |
| [tests/e2e/customer-auth.test.ts](../tests/e2e/customer-auth.test.ts) | Application regression checks for customer auth. |
| [tests/e2e/customer-freshness.test.ts](../tests/e2e/customer-freshness.test.ts) | Application regression checks for customer freshness. |
| [tests/e2e/customer-partner.test.ts](../tests/e2e/customer-partner.test.ts) | Application regression checks for customer partner. |
| [tests/e2e/customer-recovery.test.ts](../tests/e2e/customer-recovery.test.ts) | Application regression checks for customer recovery. |
| [tests/e2e/customer-session.test.ts](../tests/e2e/customer-session.test.ts) | Application regression checks for customer session. |
| [tests/e2e/customer-tamil.test.ts](../tests/e2e/customer-tamil.test.ts) | Application regression checks for customer tamil. |
| [tests/e2e/customer-visits.test.ts](../tests/e2e/customer-visits.test.ts) | Application regression checks for customer visits. |
| [tests/e2e/fixtures.ts](../tests/e2e/fixtures.ts) | Isolated test setup, synthetic fixtures and shared cleanup/authorization helpers. |
| [tests/e2e/partner-account.test.ts](../tests/e2e/partner-account.test.ts) | Application regression checks for partner account. |
| [tests/e2e/partner-location.test.ts](../tests/e2e/partner-location.test.ts) | Application regression checks for partner location. |
| [tests/e2e/partner-profile.test.ts](../tests/e2e/partner-profile.test.ts) | Application regression checks for partner profile. |
| [tests/e2e/partner-recovery.test.ts](../tests/e2e/partner-recovery.test.ts) | Application regression checks for partner recovery. |
| [tests/e2e/partner-tamil.test.ts](../tests/e2e/partner-tamil.test.ts) | Application regression checks for partner tamil. |
| [tests/e2e/partner-visits.test.ts](../tests/e2e/partner-visits.test.ts) | Application regression checks for partner visits. |
| [tests/e2e/test.ts](../tests/e2e/test.ts) | Isolated test setup, synthetic fixtures and shared cleanup/authorization helpers. |
