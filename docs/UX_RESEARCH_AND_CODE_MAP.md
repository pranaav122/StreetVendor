# Familiar workflows and explainable code

Research checkpoint: 5 November 2026. This document connects the requested Uber, Rapido, Swiggy and Zomato references to MyStreetVendor's existing modules and proposed redesign. Colours are provisional; choose them later through the shared tokens.

## What the evidence establishes

Public guides describe product behaviour. Engineering articles explain implementation choices. Neither proves the exact cause of popularity or usability for our vendors. The reasons below are our design hypotheses, grounded in those observations. Validate them with actual customers and vendors. Current signed-in competitor apps were not tested.

| Source | Observed evidence | Limit |
| --- | --- | --- |
| [Uber trip guide](https://www.uber.com/ca/en/drive/basics/how-to-take-trips/) | Going online, receiving a request, accepting and navigating form a sequence. | A public guide, not a measured usability comparison. |
| [Uber navigation help](https://help.uber.com/en-AU/driving-and-delivering/article/using-a-third-party-navigation-app?nodeId=d318eceb-3502-4be1-94a8-ce7249e5e5ec) | A navigation action can hand off to the selected map application. | Behaviour can vary by platform and region. |
| [Rapido privacy policy](https://www.rapido.bike/Privacy) | Captain location use is associated with activating On-Duty, including background use. | Describes data use, not evidence that permission explanations are easy to understand. MyStreetVendor retains its own stricter sharing boundaries. |
| [Swiggy engineering article](https://medium.com/swiggy-bytes/architecture-and-design-principles-behind-the-swiggys-delivery-partners-app-4db1d87a048a) | Separates UI from long-running device work and discusses state, debugging and stability. | Published in 2019; an architecture reference, not a description of today's entire app. |
| [Apple interview with Swiggy's team](https://developer.apple.com/news/?id=o5spbekm) | The team reports loading, memory and animation problems and discusses performance and consistent components. | Published September 2026; team-reported experience. It does not justify rewriting this project in Swift. |
| [Zomato product manager's retrospective](https://www.dhairyanagpal.com/work/zomato-cpo) | Describes simplifying confusing offers, scannable information and language-specific explanations for delivery partners. | A first-person portfolio account of 2024–25 work, not independently verified company research. It does not justify adding incentives or audio features here. |

## Reasons, code ownership and acceptance checks

“Existing” below means source was inspected, not that every scenario was rerun for this documentation checkpoint. Named tests are coverage to retain; see the verification record for actual execution results. Proposed UI work remains subject to the design review.

| Reason and user problem | MyStreetVendor decision | Code that owns it | Coverage and remaining work |
| --- | --- | --- | --- |
| R1. Too many competing choices obscure the next task. Uber's sequence is a useful reference. | Put availability or the blocking setup step first, then customer requests; one primary action per decision. | `apps/vendor-app/src/features/dashboard/DashboardScreen.tsx`, `apps/vendor-app/src/features/visits/VisitScreen.tsx` | Existing operations; simplified hierarchy and on-demand reason field are proposed. Add browser checks for the changed controls. |
| R2. Users should recognise destinations without remembering a menu. | Customer: Nearby / Your visits / Account. Vendor: Home / Customers / My shop / More, with visible labels and active state. | Both `src/ui.tsx` files and each app's route files. | Current navigation exists; persistent bottom navigation is proposed. Test narrow width, keyboard focus, safe areas and long labels. |
| R3. Customers need a clear meeting context before choosing a vendor. | Keep an explicit public meeting point; show categories and available vendors, not a technical coordinate form as the main introduction. | Customer `features/discovery/meeting.tsx`, `NearbyScreen.tsx`, `features/vendors/VendorScreen.tsx` | Point selection and category discovery exist. Simpler selection remains proposed; changing a label must not invent coordinates or a geocoding service. Retain `tests/e2e/customer-freshness.test.ts`. |
| R4. An unexplained wait makes users repeat actions. | Show pending, accepted, approaching, arrived and terminal states using actual server responses. Make the active visit easy to reopen. | Both visit screens/lists, `packages/api-client/src/realtime.ts`, `backend/app/visits/state.py` | Workflow exists; simpler progress presentation is proposed. Retain `tests/e2e/customer-visits.test.ts` and `partner-visits.test.ts`. No made-up ETA or automatic acceptance. |
| R5. Partners need deliberate control over work and location. Rapido's duty boundary is relevant. | Explicit Go online / Go offline; separate optional background consent. An unreadable status must not remove the offline escape. | Vendor `location/controller.ts`, `provider.tsx`, `resume.ts`, `background.ts`, `background-policy.ts` | Existing safeguards. Retain `tests/e2e/partner-location.test.ts` and vendor sharing/resume/background tests. Native background execution still needs device verification. |
| R6. Travelling should not require retyping a meeting point. | Offer directions for an authorised meeting, explaining the transfer to a map provider. | Vendor `features/visits/VisitScreen.tsx` | Existing Apple/Google Maps handoff. Check failure feedback and real-device handoff; do not add an embedded navigation engine. |
| R7. Fast readers need short, familiar language. The Zomato retrospective highlights this problem. | Short action labels, English/Tamil, locally bundled font, wrapping and text scaling. Keep user-entered names unchanged. | Both `copy.ts`, `language.tsx`, `ui.tsx`; `packages/design-tokens/tokens.json` | Translation and sizing exist; new labels need translation. Retain `tests/e2e/customer-tamil.test.ts`, `partner-tamil.test.ts` and language tests. Pilot review of Tamil wording remains open. |
| R8. A beautiful screen still feels difficult if it hangs or fails silently. Swiggy's accounts support attention to this. | Keep device work outside screen components, bounded requests and visible loading/error/retry states. | Vendor location modules, shared `ApiClient`, React Query usage in screens. | Existing structure. Preserve unit tests and failed-refresh flows. Measure real-device response times before claiming performance gains; do not import Swiggy's infrastructure. |
| R9. Retries must not create duplicate visits or apply an outdated decision. This is our distributed-system requirement. | Reuse the request intent key after an uncertain response; use expected versions for decisions. | Customer `features/visits/intent.ts`, backend `visits/service.py`, both visit screens. | Existing protections. Retain customer unit tests and the concurrent-decision case in `tests/e2e/partner-visits.test.ts`. A disabled button alone is insufficient. |
| R10. Progress must not expose old or unauthorised location. This is our privacy requirement. | Validate freshness and access; clear private caches on logout, account change and terminal visits. | Customer `intent.ts`, both `session.tsx`, shared `realtime.ts`, backend `visits/tracking.py` and `privacy.py`. | Existing rules. Retain session, tracking and completion tests. Never replace a stale position with a fake live state. |
| R11. Rare settings and problems should remain accessible without crowding daily work. | Put settings/history in More or Account; keep visit help/reporting close to the active visit. | Both account screens and visit screens; vendor profile screen. | Existing features, proposed grouping. Check that cancellation, reports, deletion confirmation, recovery and language remain reachable. |

All identified reasons have an owner and an acceptance check here. This is traceability, not a claim that all proposed changes are implemented or proven usable.

## Explain a module in your own words

Use four sentences: **what it receives, what it does, what it returns or changes, and what would break if it disappeared.** Then follow one actual caller and one test. The complete file inventory remains [FILE_GUIDE.md](FILE_GUIDE.md); the guided walkthrough remains [PROJECT_HANDBOOK.md](PROJECT_HANDBOOK.md).

| Module or group | What it does and why the boundary exists |
| --- | --- |
| App route files | Select the correct screen after session restoration. They keep navigation separate from business decisions; a route is not another API layer. |
| Customer discovery and meeting modules | Store an account-scoped, in-memory meeting choice and query vendors for that point. A chosen meeting place is not permission to track the customer continuously. |
| Customer vendor screen | Shows a vendor and turns an explicit meeting choice into a visit request. It owns the request intent, not authentication or GPS scheduling. |
| Visit screens and lists | Render current records and permitted actions, show errors and request changes. They do not decide which state transitions the server permits. |
| Vendor dashboard | Combines business approval, availability and visit summary for the next useful action. It calls the sharing controller instead of creating its own GPS loop. |
| Vendor profile | Edits business details and requests review. Staff approval remains separate so a vendor cannot approve themselves. |
| `ui.tsx` in each app | Owns readable controls and app-specific navigation. Share palette/type tokens; separate navigation because customer and vendor tasks differ. |
| `copy.ts` and `language.tsx` | Separate translation data from the current-language provider. Business names pass through unchanged; both screens and common controls use the same language choice. |
| `session.tsx` in each app | Connects authentication, role validation, queries and realtime lifecycle. Cancelling queries before clearing prevents late responses restoring private data. |
| Shared `api-client/src/index.ts` | Sends authenticated HTTP requests and coordinates token refresh. One refresh path prevents screens racing over credentials. |
| Shared `storage.ts` | Adapts validated sessions to native secure storage or browser memory. It prevents browser previews silently persisting bearer tokens. |
| Shared `realtime.ts` | Manages authenticated sockets, bounded reconnects and visit subscriptions. HTTP remains the source used to resynchronise current state. |
| Customer `intent.ts` | Keeps retry identity and evaluates location freshness. These small rules can be tested without a screen or device. |
| Vendor `location/controller.ts` | Runs online/offline state and invalidates late callbacks. Without it, an old upload could race a later offline decision. |
| Vendor `location/provider.tsx` | Connects that controller to Expo sensors, API calls and app lifecycle. Device integration is kept out of the pure controller. |
| Vendor `location/resume.ts` | Rechecks permissions and server availability on return to the app. Being online before suspension does not prove current permission. |
| Vendor `location/background.ts` | Registers the OS callback and stores consent securely. A native callback may run when no React screen is mounted. |
| Vendor `location/background-policy.ts` | Checks session/consent identity and fixes before a background send. OS integration and send eligibility have different test needs. |
| Notifications and recovery-link modules | Adapt external OS/email events into the current authorised workflow. They validate identifiers and never grant access merely because a link or notification contains them. |
| Backend routers, schemas and services | Routers adapt HTTP, schemas validate input/output, services own authorised changes and transaction boundaries. The database and server remain authoritative. |
| Backend visit state, arrival, tracking and privacy | Separate legal transitions, arrival evidence, current tracking access and erasure. They protect different rules; merging them to reduce file count would hide those rules. |
| Shared types and design tokens | Keep contracts and visual constants consistent across independent apps. Colour changes belong in the token source rather than repeated screen literals. |

## Comments and minimum-code rules

Module comments explain the responsibility and why a separate boundary exists. Inline comments explain non-obvious reasons: stale callbacks, consent checks, retry identity, cache cleanup, transaction locks and privacy erasure. Do not narrate obvious imports, loops or assignments.

Before removing code, identify its callers, the rule it protects and the test that covers it. Fewer lines do not justify removing authorization, validation, cleanup, error states, translations or concurrency protection. Remove a helper only when its unnecessary role is demonstrated; do not add a helper merely to give an ordinary expression a name.

Use existing components, Expo services, map applications and shared tokens. This research adds no payment system, delivery fleet, rewards, advertising, AI feature, new library or competing state framework. Temporary HTML mockups demonstrate interaction; their demo scripts and fictional data must never be copied into production screens as business logic.

## Acceptance with real users

Ask a vendor to find their approval state, go online, accept a visit, open directions and go offline. Ask a customer to choose a meeting point, select a vendor, request a visit and reopen its progress. Repeat with Tamil, larger text, denied location and a failed connection. Observe wrong taps, help requests and task completion; establish a baseline before setting improvement targets. We have not run this pilot, so no usability success rate is claimed.

## Research/comment checkpoint verification (c6d38d4)

The changes are this guide, reading links and responsibility comments in 12 existing TypeScript modules. No executable statements, dependencies, API contracts or UI layouts changed. A TypeScript scanner comparison against the preceding commit confirmed identical executable tokens in those modules.

Actual PowerShell checks: shared `npm run typecheck` and both app-workspace type checks passed; `npm run test:client` passed 22 tests, `npm run test:customer` passed 6, and `npm run test:partner` passed 29, with zero failures. `git diff --cached --check` passed before commit. Explicit source/test paths in this guide were checked for existence. Browser, backend, physical-device and usability-pilot checks were not rerun for this comments/documentation checkpoint. Earlier results remain historical evidence, not new verification of the proposed redesign.
