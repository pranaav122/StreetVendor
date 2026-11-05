# Simple mobile interface implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, task by task. Keep a progress ledger. No new worktree: the user requires checkpoints on the current main branch.

**Goal:** Make both apps understandable through familiar task flows, with particular attention to everyday street vendors.

**Architecture:** Keep existing routes, API contracts, location controllers and state rules. Change presentation, navigation and progressive disclosure using current React Native controls. Reuse existing palette and bilingual fonts.

**Tech stack:** Expo Router, React Native, React Query, TypeScript, existing Playwright/PostgreSQL harness.

**Spec:** Root DESIGN.md and docs/UX_RESEARCH_AND_CODE_MAP.md. User approved implementation on 5 November 2026.

## Global constraints

- Use PowerShell. Commit and push each coherent checkpoint to origin/main; verify remote SHA.
- Keep current colours. Add no dependencies, fake data, fabricated place search or payment features.
- Controls remain at least 56 high; navigation targets at least 48. Support Tamil wrapping, text scaling and safe areas.
- Preserve roles, sharing consent, safe offline escape, freshness, request idempotency, server versions and privacy cleanup.
- Comment non-obvious reasons; explain ordinary code through names. Preserve existing failure and empty states.

## Review focus

1. Failed initial business read: vendor can still go offline.
2. Long Tamil labels and large text: no horizontal overflow or hidden navigation.
3. Pending/rejected/suspended approval: next step is clear without bypassing the restriction.
4. Late/conflicting request results: UI shows committed state, never optimistic acceptance.
5. Denied customer GPS: manual public meeting selection remains available.

## Task 1: Record the approved design

- [x] Save root DESIGN.md, CLAUDE.md guidance and this plan; link existing design documentation and update file inventory.
- [x] Check local links, token consistency and git diff; commit/push/verify.

## Task 2: Persistent labelled navigation and controls

Files: both apps' src/ui.tsx and src/copy.ts; tests/e2e/mobile-navigation.test.ts; existing browser tests whose visible navigation labels change.

Interface: retain Page({title, children, navigation?, translateTitle?}); consume usePathname to mark the active destination. Keep navigation outside the content ScrollView. Use existing safe-area support and labelled links. Keep navigation hidden on authentication screens. Vendor labels: Home, Customers, My shop, More. Customer labels: Nearby, Your visits, Account.

- [x] Write real browser cases asserting destinations, active state and navigation visibility after scrolling a long screen; verify failure on old layout.
- [x] Update Page and translations without changing screen business logic. Preserve links and keyboard access; avoid duplicate screen headings from retained routes.
- [x] Verify type checks, contrast, navigation tests and affected profile/account/Tamil flows; inspect diff; commit/push/verify.

## Task 3: Vendor daily workflow

Files: vendor dashboard, visit detail/list, profile, account, authentication and copy modules; partner-location, partner-visits, partner-profile, partner-account and partner-tamil browser cases.

Interface: continue consuming useSharing controller/state, ownBusiness and server allowed_actions. Use an explicit labelled state and conditional next action. Group background-sharing controls behind a disclosure without hiding the offline escape. Request cancellation/decline reveals a reason field before submission. Keep report controls reachable through help; do not introduce another state machine.

- [x] Add failing interaction checks for simplified online action, on-demand decline reason, active visit action and approval next steps. Preserve failed-read offline coverage.
- [x] Reorder and simplify screens, replace nested presentation ternaries with named decisions, translate all new copy. Keep actual expiry and conflict feedback.
- [x] Run partner unit/type/browser checks, inspect phone/Tamil/large-text states; commit/push/verify.

## Task 4: Customer discovery and visit workflow

Files: customer NearbyScreen, VendorScreen, VisitScreen, VisitListScreen, AuthScreen, AccountScreen and copy; customer browser cases.

Interface: retain MeetingProvider, VisitIntent, server category filtering and location freshness. Promote the optional Use current location action and meeting label; put raw coordinate entry in a manual alternative. Keep list default, optional map, and pagination. Present actual visit states as a readable progress sequence with one main allowed action.

- [ ] Add failing cases for accessible manual meeting alternative, active visit reopening and current status presentation.
- [ ] Implement with existing components; preserve customer permission denial, stale discovery, terminal privacy and retry behaviour.
- [ ] Run customer/client unit and type checks and customer browser flows; inspect empty/loading/error/long-text states; commit/push/verify.

## Task 5: Integrated verification and learning guide

- [ ] Run all mobile unit suites, strict type checks, contrast and the complete application browser suite against its isolated database.
- [ ] Run mobile platform exports appropriate to changed presentation and inspect both running apps at phone width. Report physical-device checks separately.
- [ ] Review the final diff against every R1–R11 requirement and source comments. Update research coverage from proposed to implemented only with matching evidence; update file guide and verification record.
- [ ] Perform final review, fix material findings with regression checks; commit/push/verify. Restore Wi-Fi previews with the phone-accessible API URL.
- [ ] Mark the active goal complete only when the live interface meets the approved scope and verification supports it. Any device-only uncertainty remains explicitly reported.
