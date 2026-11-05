---
# gstack: design-md-format=spec
name: MyStreetVendor
description: A calm, readable working app that makes a vendor's next action clear.
colors:
  primary: "#185C42"
  on-primary: "#FFFFFF"
  background: "#F7F5EF"
  surface: "#FFFFFF"
  text: "#18352A"
  text-muted: "#4F6257"
  subtle: "#E2EEE5"
  border: "#BDC7BE"
  error: "#A12A2A"
typography:
  display:
    fontFamily: Noto Sans Tamil
    fontWeight: 700
    fontSize: 28px
    lineHeight: 40px
  body:
    fontFamily: Noto Sans Tamil
    fontWeight: 400
    fontSize: 18px
    lineHeight: 28px
  supporting:
    fontFamily: Noto Sans Tamil
    fontWeight: 400
    fontSize: 14px
    lineHeight: 22px
rounded:
  control: 12px
  panel: 20px
  navigation: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    minHeight: 56px
  button-secondary:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    minHeight: 56px
  input:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.control}"
    minHeight: 56px
  request-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
---

# MyStreetVendor

## Overview

**Creative North Star:** “I know exactly what to do next.”

This proposal updates the existing Expo vendor application for English- and Tamil-speaking street vendors. Customer screens follow the discovery, request and progress flow below. Staff screens retain their current behaviour. Vendors should recognise their shop, see whether they are online, and handle the next customer without reading a dashboard manual.

This is an Operate surface: short tasks, readable controls, and accurate state take priority. The design preview uses clearly labelled fictional data. It is not connected to the API and does not prove device location or production behaviour.

## Research and evidence

- Khatabook's published guide uses everyday transaction wording and customer-centred flows: https://khatabook.com/blog/khatabook-app-features/ . The guide was published in 2020, so it is a wording reference, not proof of its latest interface.
- Uber's current published Driver guide separates Home, Earnings, Inbox and Menu and makes going online a prominent action: https://www.uber.com/us/en/drive/driver-app/ . Its availability and request flow is relevant; its earnings features are outside this product's scope.
- Square's published item-grid guide puts frequent seller tasks within direct reach: https://api.squareup.com/help/gb/en/article/8334-set-up-item-grid . Use that principle without importing a billing grid.
- PhonePe Business, Vyapar, Paytm Business and myBillBook were considered as merchant category references. Their payment, accounting and inventory features do not establish a need for those features here.

Research used public official pages and published guides. Signed-in competitor applications and current device screens were not inspected. There was no independent design agent; the user chose one direction. Figma inspection was blocked by the connected Starter-plan MCP call limit. No new Figma frames were created.

## Colors

Retain the existing product palette. Use the solid primary color for the next useful action. Neutral surfaces carry ordinary content; errors use both a written explanation and the error color. Availability always has an explicit label, never a dot alone.

Light mode is the implementation target because vendors may use the app outdoors. The preview's dark-color switch is an exploratory comparison only; it does not add a dark-mode implementation requirement.

## Typography

Keep the locally installed Noto Sans Tamil font for both languages. Regular and bold TTF files were inspected in `@expo-google-fonts/noto-sans-tamil`; the package includes the SIL Open Font License 1.1. Expo already bundles these weights. The HTML preview embeds the same files and makes no font-network requests.

Names, descriptions and meeting labels remain user data and are never translated as interface copy. Allow text scaling, multiline labels and scrolling. Shortlist consideration was Noto Sans Tamil for continuity and Tamil coverage, Hind Madurai for Tamil-focused UI, and Source Sans 3 for English UI. Only the existing verified font is adopted; adding a second family would bring no clear benefit for this task.

## Layout

Use a single column and four persistent bottom destinations: **Home, Customers, My shop, More**. Icons accompany visible text labels. On narrow phones and with larger text, navigation can grow taller and labels can wrap. Keep content clear of the iPhone safe area and on-screen keyboard. Avoid horizontal page scrolling.

The shop name is the page identity. The repeated uppercase Partner eyebrow is removed. The active destination is marked accessibly. Existing routes can remain `/`, `/visits`, `/profile` and `/account`; label changes do not require a new API or a router rewrite.

Home is ordered by current need: availability or the blocking setup step, customer requests, then a quiet completed-visit summary. Statistics never imply sales or earnings. A new request or active visit should lead directly to its current server-authorised next action.

## Components and behaviour

### Home

- Approved and offline: explain that the vendor is offline and show **Go online**. Keep a short location-consent explanation adjacent to that action.
- Starting or stopping: show a waiting label and prevent duplicate conflicting actions.
- Online on this device: show the current sharing state and a clearly reachable **Go offline** control.
- Business marked online elsewhere: explain that this device has not started location updates; never imply a live signal from it.
- No profile: offer **Set up my shop** as the next action.
- Pending, rejected or suspended: explain the restriction in ordinary words and offer the permitted next step. Do not hide the reason or bypass approval.
- Failed status read or refresh: keep **Go offline** accessible because an OS location task may still exist. Retain errors and retry.
- Stale or denied location: state the problem and next useful action. Do not show an online success before the server accepts a valid fix.

### Customers and visits

Use **New / Active / Past** organisation without changing which records the server returns. Always distinguish loaded results from a complete history and retain pagination. Dates and deadlines come from actual records.

A pending request shows the customer's name, meeting label, deadline and **Accept visit**. **I can't make it** reveals a labelled reason field and explicit decline submission; merely revealing it changes nothing on the server. Explain exact-location sharing before acceptance.

An accepted visit shows the meeting point and the next allowed action. Display **I'm on my way** for the existing `approach` action. **Open directions** remains available and explains the transfer to the map provider. Keep automatic arrival, freshness checks and completion rules intact. Replace the sensor-timing paragraph with a short instruction and put detailed troubleshooting in help. Do not invent distance, ETA or arrival success.

Cancellation and reporting remain accessible under visit help. Required reasons, validation errors, server version conflicts and explicit destructive confirmations must remain intact. Only committed server responses advance the displayed workflow.

### My shop

Show the review result in plain language. Keep actual shop details, categories, save feedback and review submission. Separate editing from approval guidance. Do not add identity-document collection.

### More

Group language, past visits, location settings, optional notifications, account and help. Location settings explain foreground operation and optional native background sharing; the feature is not enabled by hiding it behind a simpler label. Keep account deletion behind deliberate confirmation and recent authentication. Signing out still stops sharing and clears private state.

### Authentication

Retain email/password authentication, English/Tamil choice, account creation and recovery. Use a direct sign-in heading and one primary action. Do not replace authentication with phone OTP, social login or a changed password policy as part of this design task.

## Elevation and shapes

Use spacing and borders to separate sections. Reserve a panel for a request that needs a decision; do not wrap every sentence in a card. The preview's outer phone frame and shadow are presentation scaffolding, not a component to implement.

## Motion

Use functional pressed and loading feedback. Optional short transitions may use 150–200 ms ease-out. Respect reduced-motion settings; no repeating decoration, confetti or animated availability pulse. A short confirmation after a committed request action is the only authored transition.

## Do's and don'ts

- Put the next relevant task first and keep secondary actions quieter.
- Keep controls large, readable and reachable; let translations increase height.
- Retain consent, current availability, permission errors and the offline escape.
- Do not display raw coordinates or technical sensor rules as the main meeting information.
- Do not add fake revenue, graphs, distances, stock imagery or decorative feature cards.
- Do not add a new design library, icon package or font dependency for this change.

## Verification required for implementation

Run the existing partner unit tests, strict type checks, contrast check and relevant partner browser flows. Add coverage where changed interaction creates a real risk: reason fields revealed on demand, safe offline access during failed reads, bottom navigation at phone width, and Tamil/large-text wrapping. Exercise loading, no profile, approval restrictions, permission denial, failed refresh, request conflict, pagination and active-visit actions. Match tests to behaviour, not component structure.

The HTML preview is not a substitute for these checks. Real iPhone location, background execution and notification delivery need a secure preview or native build and device verification.

## Decisions log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-05 | Keep the existing palette and verified bilingual font | Familiarity and legibility matter more than introducing a new visual identity. |
| 2026-11-05 | Prioritise availability and the next customer over statistics | Serves the user's stated “I know exactly what to do next” goal. |
| 2026-11-05 | Put less frequent settings in More | Reduces choices on Home at the cost of one extra tap. |
| 2026-11-05 | Keep safety and sharing controls explicit | Simpler presentation must preserve consent and truthful state. |


## Customer workflow

The customer app uses Nearby, Your visits and Account as persistent destinations. Begin with an explicit public meeting point, then categories and available vendors, vendor details, one Request a visit action and current visit progress. GPS is optional for customer discovery: manual coordinates remain under a clearly labelled alternative until a real place-search provider is available. Do not invent geocoding, available vendors, ETAs, prices or live locations. Category filtering remains server-backed; a local search, if present, must clearly apply only to loaded results.

A customer can reopen active visits from Your visits, see fresh authorised tracking and find help/cancellation. Keep pending, accepted, approaching, arrived and terminal states explicit. Retain pagination, conflict recovery and duplicate-request prevention. Translate new interface labels into Tamil without changing business or customer names.

## Scope and approval

The user approved applying the Customer and Vendor previews on 5 November 2026. Both mobile apps are in scope. Colours remain unchanged and provisional for a later choice. The mockups are interaction references; implement with existing React Native components and actual API state rather than copying demonstration scripts or fictional data. Figma MCP was unavailable due to its Starter-plan quota; do not claim a new Figma deliverable.

The module responsibilities and acceptance checks in docs/UX_RESEARCH_AND_CODE_MAP.md are part of this specification. Code comments explain non-obvious decisions, privacy, transaction boundaries and cleanup. Preserve functionality during simplification; add no dependencies without a demonstrated need.
