# MyStreetVendor operations and verification implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Produce a deployable self-hosted package, prove local end-to-end behavior and review security before release.

**Architecture:** One API process and PostgreSQL/PostGIS behind Caddy on an Ubuntu VPS. Keep migrations explicit, restrict the runtime database role and retain off-server backup/restore procedures.

**Tech Stack:** Docker Compose, Caddy, PostgreSQL tools, PowerShell local scripts, shell scripts inside Linux containers, existing test tools and Codex Security.

**Spec:** [Complete MVP design](../specs/2026-11-02-complete-mvp-design.md), [deployment](../../DEPLOYMENT.md) and [security](../../SECURITY.md).

## Global constraints

The [complete plan](2026-11-02-complete-mvp.md) applies. No public database port, no committed secrets, no invented hostname/provider credentials. A passing local smoke test does not prove real native delivery or public deployment. Commit and push each coherent verified change.

## Review focus

- A deployment must refuse missing required signing/domain/runtime secrets safely.
- The runtime database account cannot perform DDL or create privileged users.
- A backup must be restored and queried in an isolated target before being described as usable.
- API/database restarts must recover jobs without exposing private stale state or replaying unauthorized notifications.
- Browser/native/public-TLS checks must be distinguished from tests running only inside containers.

## Task 1 Production package and database privileges

**Files:** Create `infrastructure/compose.production.yaml`, `infrastructure/Caddyfile`, `infrastructure/scripts/bootstrap-roles.sh`, `infrastructure/scripts/migrate.sh`, `infrastructure/.env.production.example`, `backend/tests/test_production_config.py`; update backend container build target and structured logging configuration.

**Interfaces:** Same app/config contract as development, with separate runtime and migration database URLs/credentials. Caddy routes the public API and admin application over private Docker networks; database ports are unpublished.

- [ ] Write failing configuration tests for missing required secrets, published database port, several API workers and weak/missing production signing configuration.
- [ ] Run the configuration tests and confirm failure before adding the production configuration.
- [ ] Implement explicit migration/bootstrap flow, restricted application role, JSON logs with request IDs, proxy/origin settings, health checks and restart limits. Do not include test/development dependencies in the production image.
- [ ] Build and validate the production package locally; test actual permission denial for DDL under the runtime role and continued approved API operations.
- [ ] Commit and push the verified production package.

## Task 2 Backup restore and complete local workflow

**Files:** Create `infrastructure/scripts/backup.sh`, `infrastructure/scripts/restore-check.sh`, `infrastructure/scripts/Backup-Database.ps1`, `infrastructure/scripts/Test-Restore.ps1`, `infrastructure/scripts/Test-Stack.ps1`, `backend/scripts/demo_workflow.py`, `backend/tests/test_end_to_end.py`; update deployment/debugging/verification documents.

**Interfaces:** Backup creates a custom-format dump file and copies/transfers files without PowerShell binary text piping. Restore accepts only an explicitly isolated destination. Demo uses synthetic users and authenticated APIs.

- [ ] Write failing checks for unsafe restore target, missing dump, failed restore/query and unavailable database/provider handling.
- [ ] Implement dump/restore validation, permission-safe scheduling examples and off-server configuration instructions. Keep generated backups ignored.
- [ ] Run a local isolated restore and query PostGIS/revision and representative business records. Record actual result and cleanup.
- [ ] Exercise registration, verification, online fix, nearby discovery, request, acceptance, authorized tracking, arrival/completion and history. Check wrong-user tracking denial, cancellation race, token expiry and notification retry separately.
- [ ] Record available UI/native/provider outcomes precisely; commit and push the verified helpers/results/docs.

## Task 3 Security review and release gates

**Files:** Security report and coverage in the scan's authoritative location, necessary fixes/tests, `docs/VERIFICATION.md`, updated README/roadmap/API/database/deployment/debugging guides and a later learning guide.

**Interfaces:** Follow the Codex Security desktop scan and reporting workflow. Every finding must have source evidence and validation; do not label an unavailable scan or unreviewed provider flow as clean.

- [ ] Run the complete local test/type/build/migration suite and preserve actual failures before proposing fixes.
- [ ] Execute the requested Codex Security scan across backend, applications and production configuration. Review its declared coverage and validate findings.
- [ ] Repair confirmed problems using focused failing regression tests, then rerun the relevant checks. Commit and push each verified fix.
- [ ] Have an independent reviewer inspect the complete release change, especially authorization, refresh concurrency, precise-location disclosure, socket revocation and device ownership transfer.
- [ ] Present a final checklist with passed, failed, skipped and externally blocked checks. Update implementation status without rewriting the dated Phase 1 evidence as though it were current.
- [ ] When owner inputs are provided, perform actual VPS/TLS, signing, physical-device and real notification checks before claiming those release gates passed.

## Completion definition

Local software completion requires real integrated code and passing available checks, usable independent applications/admin interface, migrations and an exercised deployment/restore package. Public release completion additionally requires the owner-dependent server, provider, signing and physical-device evidence. Report the distinction directly and link the exact GitHub commits.
