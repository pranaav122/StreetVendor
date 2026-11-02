# MyStreetVendor complete MVP implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Complete the integrated backend, independent Customer and Partner apps, compact admin dashboard, production package and verification for the existing MyStreetVendor MVP.

**Architecture:** Keep the current FastAPI modular monolith with SQLAlchemy/Psycopg, Alembic and self-hosted PostgreSQL/PostGIS. Add business modules incrementally, a durable SQL outbox, one API process for realtime, independent Expo projects and a small shared transport/types package.

**Tech Stack:** Existing Python 3.13/FastAPI/SQLAlchemy/PostGIS foundation; Argon2id/PyJWT; Expo/React Native/TypeScript; Next.js administration; Docker Compose/Caddy; Pytest and appropriate JavaScript tests.

**Spec:** [Complete MVP design](../specs/2026-11-02-complete-mvp-design.md), [API contracts](../../API.md), [database design](../../DATABASE.md), [security](../../SECURITY.md).

## Global constraints

- Use Windows PowerShell and the current project folder. Preserve existing work and migrations.
- Keep one FastAPI modular monolith and self-hosted PostgreSQL/PostGIS. Do not switch the project to Neon, Supabase, Firebase authentication/database or a managed platform.
- Keep Customer and Partner applications separate. Do not share their screens or introduce a role-switching app.
- Use UUIDs, UTC timestamps, named constraints, `geography(Point,4326)` and metre-based indexed searches.
- Access expiry: 600 seconds. Refresh-family expiry: 30 days. Pending expiry: 5 minutes. Accepted-visit expiry: 60 minutes.
- Latest-fix age: at most 90 seconds; future tolerance: 30 seconds; accuracy: at most 100 metres. Arrival: two fixes at least 5 seconds apart, within 50 metres, age at most 30 seconds, accuracy at most 30 metres.
- Keep precise locations private until request acceptance; revoke access at termination/offline/suspension. Preserve retention deadlines from the spec.
- Reject client role/verification/ownership escalation and unknown business-write fields.
- Run relevant checks, inspect the staged change, commit and push to `pranaav122/StreetVendor` after every coherent change. Verify the pushed SHA. Never force push or commit secrets.
- Do not claim production deployment, store release or real push/background tracking based only on local mocks or a web preview.

## Work packages

The subsystems have separate plans so each package produces something independently testable:

1. [Backend business features](2026-11-02-backend-mvp.md): authentication, vendors, spatial features, visits, realtime, notifications and administration APIs.
2. [Applications and design](2026-11-02-applications.md): Figma reference, shared typed client, both Expo applications and admin dashboard.
3. [Operations and release verification](2026-11-02-operations.md): production configuration, backups, full workflow, security audit and owner-dependent release gates.

## Review focus

- Refresh reuse or two concurrent refreshes must not leave stolen sessions valid or create an infinite client retry loop; cover in backend task 1 and application task 2.
- An offline/suspension transition racing a location update must not re-expose a private point; cover in backend tasks 2 and 3.
- Concurrent accept/cancel/expiry must produce one valid state/event sequence; cover in backend task 4.
- A token moving between device owners or a provider timeout must not leak a previous account's messages; cover in backend task 6.
- A native app resuming with revoked permission or stale credentials must stay visibly unavailable until checked; cover in application tasks 3 and 4.

## Execution and checkpoints

- [ ] Review this plan and preserve the chosen execution method.
- [ ] Verify foundation tests against the actual current environment; record fresh results rather than reusing the October counts.
- [ ] Execute backend tasks in order, keeping commits small and pushed.
- [ ] Complete the Figma/design reference and both application workflows against the actual API.
- [ ] Complete the admin interface and operational package.
- [ ] Run the full local workflow, security review and restore rehearsal; repair verified failures.
- [ ] Present working software, exact commands, actual results and any owner-dependent release checks.

Recommended execution is native work in this chat with one independent whole-branch review at the end. The shared schema, auth and event contracts are tightly connected; a single implementer can keep them consistent while focused tests and Git checkpoints expose regressions. If the owner chooses subagent-driven execution, use the same interfaces and disjoint task ownership with the required reviews.
