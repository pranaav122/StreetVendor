# MyStreetVendor interface design

The approved 5 November simplification is specified in [root DESIGN.md](../DESIGN.md). It governs new Customer and Vendor UI work; the historical implementation notes below remain context. Colours are unchanged pending a later choice.

The Customer and Partner apps have separate navigation and screens. They share colour, spacing and type tokens in `packages/design-tokens/tokens.json`. These are initial product choices, not an existing brand identity.

## Visual rules

Use a warm background (`#F7F5EF`), white surfaces, dark green text (`#18352A`) and primary actions (`#185C42`). Reserve red (`#A12A2A`) for errors and destructive actions. Do not communicate state through colour alone: show its name and the next useful action.

Use Noto Sans Tamil regular and bold for English and Tamil. Body text starts at 16 with 26 line height; headings start at 28 with 38 line height. Allow device text scaling, multiline labels and vertical scrolling. Inputs and buttons have a minimum height of 52 and a minimum touch area of 48. Long translations must increase control height rather than truncate.

Spacing steps are 4, 8, 16, 24 and 32. Controls use radius 12; cards use radius 20. Use a single primary action per decision. Keep ordinary navigation and secondary actions visually quieter. Destructive actions require explicit confirmation.

The executable contrast check is `node packages/design-tokens/check-contrast.mjs`. Actual results: text/background 12.18:1; text/surface 13.28:1; muted/surface 6.53:1; muted/background 5.99:1; white/primary 7.93:1; danger/surface 7.29:1; primary/subtle 6.64:1. These meet the 4.5:1 normal-text target. This arithmetic does not prove final screen usability.

## Customer routes and states

| Route or flow | Content and required states |
| --- | --- |
| Sign in, register, recover | Email/password, validation, submitting, rejected credentials, offline, expired recovery link and successful confirmation. No role switch. |
| Nearby | Explicit public meeting point, permission request/denial, manual coordinates, categories, map/list, loading, no available vendors, stale results, retry and out-of-area errors. |
| Vendor details | Business information, categories, review/availability status and coarse public area. Request action needs an explicitly selected meeting point. |
| Visit | Pending, accepted, approaching, arrived and terminal states; current allowed actions and expiry. Show precise tracking only while authorized and fresh. |
| History | Actual server results, empty/loading/error, status and time. A completed visit does not imply a sale. |
| Account | Language, email confirmation, password recovery, sign out, recent-login requirement and explicit account-deletion confirmation. |

## Partner routes and states

| Route or flow | Content and required states |
| --- | --- |
| Sign in/register | Vendor identity only, recovery and email confirmation. |
| Business profile | Name, description, categories, minimal review note, draft/pending/verified/rejected/suspended states. No government-document upload. |
| Dashboard | Available/offline state, visible sharing status, verification restrictions, accurate-fix check, permission denial, stale signal and network interruption. |
| Incoming visits | Pending deadline, accept/decline, submitting and version conflict. Refresh current state after a conflict. |
| Active visit | Authorized meeting point, external navigation, progress, automatic arrival result, completion/cancellation and report action. |
| History/summary | Visit counts for the India calendar day, empty and error states. Label counts as visits, not earnings or sales. |
| Account | English/Tamil, permission explanation, sign out/offline cleanup and guarded deletion. |

Example labels: `Go online` / `ஆன்லைனில் செல்லவும்`; `You are offline` / `நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்`; `Visits today` / `இன்றைய சந்திப்புகள்`. Keep translated controls on multiple lines when needed. Tamil wording still needs review by pilot users.

## Privacy and freshness

Ask for a public meeting point rather than a home address. Nearby results represent approximate areas. Show captured timestamps on exact tracking and distinguish a stale position from a live fix. Do not place coordinates, names or report reasons in push text. Explain that background operation depends on operating-system permission and scheduling.

Signing out clears private query caches and subscriptions. Terminal visits remove tracking immediately. Permission denial must still leave account/help/history usable; customer discovery can use an explicitly entered meeting point. Partner sharing needs usable permission and a first validated fix.

## Figma handoff and limitation

[Customer and Partner draft reference](https://www.figma.com/design/yNVYbOmV7ZDJYaToMdJOG7) contains separate pages and four screens per application. It uses editable text, frames and imported Simple Design System button/input instances. The Customer wrapper has 39 text nodes and 8 instances; the Partner wrapper also has 39 text nodes and 8 instances. Neither contains flattened UI images, and the font check found no Noto Sans Tamil mismatches.

The visual preview **failed**: some text is clipped and the imported Customer spacing token resolved to zero. Figma's Starter-plan MCP quota blocked the corrective call. Treat these frames as a draft workflow reference, not an approved pixel specification. Code Connect was also unavailable under the connected seat. The local token file and layout rules above govern implementation while Figma is unavailable. Final app wrapping, scrolling, large text and permission states must be checked in the running apps.
