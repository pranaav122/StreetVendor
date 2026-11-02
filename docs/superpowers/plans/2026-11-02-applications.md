# MyStreetVendor applications implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver independent Customer and Partner Expo apps and a compact administration app using the real backend.

**Architecture:** Apps own their navigation/screens and share only typed transport/contracts. PostgreSQL through FastAPI remains authoritative. The admin app proxies privileged sessions through a server boundary.

**Tech Stack:** Compatible stable Expo/React Native, TypeScript strict, Expo Router, TanStack Query, React Hook Form/Zod, SecureStore, Location/TaskManager/Notifications, compatible maps; Next.js for admin.

**Spec:** [Complete MVP design](../specs/2026-11-02-complete-mvp-design.md), backend API and event contracts.

## Global constraints

Use the exact privacy/time defaults in [the complete plan](2026-11-02-complete-mvp.md). No customer/vendor role-switch app. No production secrets in client bundles. Native background location and remote push require development builds and actual device checks. Commit and push each coherent verified change.

## Review focus

- Simultaneous 401 responses trigger one coordinated refresh; revoked tokens do not cause retry loops.
- Location permission denial/revocation and stale points remain visible and stop sharing safely.
- TanStack Query caches and socket subscriptions are cleared or reauthorized on logout/terminal visit state.
- Tamil labels, large text and touch targets remain usable on a small screen.
- Admin browser code cannot obtain a privileged refresh token from JavaScript storage.

## Task 1 Shared design and Figma reference

**Files:** Create `docs/DESIGN.md`, `packages/design-tokens/`; Figma file/pages for independent Customer and Partner journeys after confirming write permission.

**Interfaces:** Tokens name surface/text/primary/error colors, spacing, typography and control sizes. App screens consume these values without sharing feature screens.

- [ ] Record critical screen states and routes from the spec, including offline/denied/empty/loading/error and Tamil/English variants.
- [ ] Load the required Figma skills, verify file-creation permission and produce a reference for discovery, request tracking, vendor dashboard/incoming visit and account flows. Report an access failure rather than inventing a Figma URL.
- [ ] Check contrast, text wrapping and touch targets in the design and document exact tokens/copy. Keep labels plain and specific using No AI Slop.
- [ ] Review the reference against the declared screen requirements; commit and push the design/tokens/handoff.

## Task 2 Workspace contracts and session transport

**Files:** Create root workspace/package lock, `packages/shared-types/`, `packages/api-client/`, independent `apps/customer-app` and `apps/vendor-app` package/configuration files; tests for refresh/transport/event parsing.

**Interfaces:** `ApiClient` exposes typed backend operations; `SessionStore` has `read`, `write`, `clear` with mobile SecureStore adapters; one refresh coordinator per application session. Public environment contains only API origin and nonsecret provider configuration.

- [ ] Write failing tests for request authorization, one refresh during concurrent 401s, refresh failure cleanup, bounded retry, request cancellation, signed-out cache clearing and invalid event payloads.
- [ ] Run the transport tests and confirm failure before implementation.
- [ ] Resolve compatible Expo packages using official docs and `expo install`; build the small shared client/types and separate app configurations, router roots and session providers. Commit exact lockfile and independent identifiers/build profiles.
- [ ] Run TypeScript strict checking, transport tests and Expo dependency checks for each app.
- [ ] Commit and push the verified workspace/client foundation.

## Task 3 Customer application

**Files:** `apps/customer-app/app/` route entries and `src/features/{auth,discovery,vendors,visits,account}/`, app-specific permission/map/notification adapters and component/flow tests.

**Interfaces:** Uses actual API client and event schemas; selected meeting point is explicit. Tracking subscribes only to authorized active visits and refetches REST state after reconnect.

- [ ] Write failing component/flow cases for login/registration, denied-location manual point, nearby loading/empty/filter errors, idempotent request action, acceptance/tracking, cancellation/history, expired auth and terminal tracking removal.
- [ ] Run tests to observe missing behavior, then implement the routes/screens and permission states with accessible controls.
- [ ] Integrate map/list results, vendor details, request version updates, notifications and safe account/deletion flows against the real API. Provide clear unavailable state when a native/provider feature is not configured.
- [ ] Run type/component/flow checks and an available-platform UI smoke test with real local backend. Record native and push checks separately.
- [ ] Commit and push each verified customer feature slice.

## Task 4 Partner application

**Files:** `apps/vendor-app/app/` and `src/features/{auth,profile,availability,location,visits,history,account}/`, top-level background task module, translation dictionaries and tests.

**Interfaces:** Availability enabling submits first usable fix; subsequent location updates use actual captured timestamps. Background callbacks read the current session/consent and stop after offline/logout. No fake operating-system delivery guarantees.

- [ ] Write failing cases for verification states, large translated controls, online-first-fix validation, denied/revoked GPS, poor accuracy, offline/logout cleanup, incoming acceptance/decline/version conflict and reconnect.
- [ ] Run focused tests before implementing the independent screens and local English/Tamil text.
- [ ] Implement foreground/background location adapters and development-build configuration, visible sharing/degraded status, request progress, external map navigation, history and visit-based daily counts.
- [ ] Run strict type and component/flow tests; exercise deterministic GPS simulation against the actual backend. Test physical background/resume behavior when a device/build is available and label anything unrun.
- [ ] Commit and push each verified partner feature slice.

## Task 5 Administration application

**Files:** `apps/admin-dashboard` routes/pages, server session/proxy, reports and verification UI, tests for role/cookie/origin behavior.

**Interfaces:** Uses protected backend administration endpoints; browser sessions use HTTP-only cookies and server-side forwarding, with CSRF/origin checks. The API remains the final authorization boundary.

- [ ] Write failing tests for non-admin access, origin/CSRF denial, private token handling, verification decisions, suspension and report updates.
- [ ] Run the tests before implementing the server session and minimal operator screens.
- [ ] Implement verification queue/details, reports, account/vendor suspension, request inspection and operational visit summaries. Keep precise location out of general admin lists.
- [ ] Run type, unit, build and browser flow checks against the actual backend; confirm rejected privileges through direct API tests as well.
- [ ] Commit and push the verified administration app.

## Application acceptance

- [ ] Customer and Partner are independent applications with independent identifiers/build configurations.
- [ ] Both use actual authenticated APIs; no local-only business state is presented as committed server state.
- [ ] Local customer-to-vendor request workflow is exercised, with screenshots/results captured from available surfaces.
- [ ] Native-only, signing, map-provider and push checks are either executed with evidence or listed explicitly as pending owner inputs.
