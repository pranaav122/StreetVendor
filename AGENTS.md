# MyStreetVendor working instructions

## Current scope

On 2 November 2026, the user authorized completing the remaining project. Earlier Phase 1-only limits in the milestone documents describe the previous scope. Continue from the existing FastAPI, PostgreSQL/PostGIS and Docker foundation, with two independent Expo applications.

Use Windows PowerShell commands. Keep code and explanations understandable to someone learning full-stack development. Report actual verification results and identify work that requires real devices, provider credentials or server access.

## Git checkpoints

The user requires a commit and push after every coherent change.

- Target repository: `https://github.com/pranaav122/StreetVendor.git`.
- Remote: `origin`. Current working branch: `main`.
- Run checks appropriate to the change, inspect the staged diff, commit, then push before starting the next change.
- Confirm that the remote branch contains the pushed commit. If a push fails, report the failure and preserve the local commit.
- Never force push or replace unrelated remote history.
- Keep `.env`, private keys, database files, local environments and private logs out of commits. `.env.example` contains placeholders only.
