# Backups and isolated restore checks

Backups contain private account/visit data, password hashes and session records.
Keep the local directory private and ignored. Encrypt before transferring off the
server; restrict storage credentials and define retention/deletion rules. These
scripts do not configure an external storage account or prove off-server recovery.

## Create and actually restore a local backup

Use PowerShell from the repository root, with Docker's CLI on PATH:

```powershell
$taskBackup = ./infrastructure/scripts/Backup-Database.ps1
$taskBackup
./infrastructure/scripts/Test-Restore.ps1 -BackupPath $taskBackup.Path
```

The first script runs PostgreSQL 18 `pg_dump` inside the database container, writes
a custom-format file there with private permissions, then uses `docker compose cp`
to copy its bytes to the ignored `backups` directory. It reports path, byte length
and SHA-256. It never sends binary dump output through PowerShell's text pipeline.
Temporary container files are removed after copying. A failed/empty copy raises an
error and is not described as usable. `-OutputDirectory` chooses another private
directory; `-DatabaseName` selects a simple explicitly named source database.

The restore checker accepts an existing nonempty dump, generates a unique
`msv_restore_<32 hex characters>` database, validates the archive, creates the new
database from `template0`, restores in one transaction and checks PostGIS, the
expected migration revision and application row counts. It prints aggregate counts
for users, vendors, visits and categories. Cleanup drops only the database it
successfully created; it never restores over development/production or reuses an
existing target. A corrupt archive fails before database creation. Missing tables,
an unexpected revision or another query error fails the drill and still triggers
cleanup. `-ExpectedRevision` defaults to current release `0006_notifications`;
update it deliberately when checking a different reviewed release.

Both wrappers support `-EnvFile`, `-ComposeFile`, `-ProjectName` and `-AsJson` for
automation. To use the production database, pass the private production file and
`infrastructure/compose.production.yaml`. The commands run as the database operator
inside its container, never as the restricted API role. Docker access is privileged.

```powershell
$taskBackup = ./infrastructure/scripts/Backup-Database.ps1 `
    -EnvFile 'C:\private\mystreetvendor.production.env' `
    -ComposeFile 'infrastructure/compose.production.yaml'
./infrastructure/scripts/Test-Restore.ps1 -BackupPath $taskBackup.Path `
    -EnvFile 'C:\private\mystreetvendor.production.env' `
    -ComposeFile 'infrastructure/compose.production.yaml'
```

The `tr` step handles Windows line endings only in the small shell source sent to
Linux. Dump bytes always travel as files. Changing text encoding is not a backup
repair strategy.

## Scheduling, encryption and promotion

Start with daily backups, alerts for failed/missing backups, a documented retention
window, and periodic restore drills. The initial proposed recovery target is at
most one day of lost writes and restoration within several hours; these are goals,
not measured guarantees. Record backup age, size/hash, restore duration and result.
Use Windows Task Scheduler or a restricted Linux timer under a dedicated operator;
store full executable/script/config paths and check its exit status. A scheduling
example should run backup, restore validation, then encryption and authenticated
off-server transfer. Fail the job if any stage fails. No schedule or provider has
been silently installed on this computer.

Choose an encryption/storage tool only after the owner controls the destination
and recovery keys. Keep a recovery key separate from the server and test decryption
and restoration on another machine. A file copied into the same Docker volume or
onto the same server does not protect against losing that server. `pg_dump` does
not contain cluster roles; retain the reviewed bootstrap role setup and private
credential recovery procedure separately. Files intentionally omit original owners
and ACLs so drills can restore safely into their isolated operator-owned target.

Promoting a restored database to serve real users is a separate reviewed operation:
recreate/restrict roles and grants, verify release/schema compatibility, reapply
deletion requests that postdate the snapshot, revoke restored sessions/devices/jobs,
disable sharing and erase restored live GPS before enabling traffic. Require fresh
consent and login. Keep restored backups isolated from mail/push/public applications
until those steps finish. Do not point the running API at a drill database.

## Actual evidence

The first six guard checks failed before scripts existed. A Windows text-mode
newline error was then reproduced and corrected for shell transport. The real
roundtrip uses an isolated migrated source, creates a verified synthetic business
and pending visit through authenticated handlers, checks the dump's `PGDMP` header,
restores it through the PowerShell scripts and verifies PostGIS/revision, at least
three users, one vendor, one visit and four categories. It also queries the cluster
to prove the restore target was removed. The original complete visit workflow plus
six initial guard checks and this roundtrip passed **8 cases in 30.61 seconds**.
The extended guard suite passed **7 cases in 12.86 seconds**, including a genuine
schema-query failure after restore and proof that its target was removed.
The final combined backup/workflow gate passed **9 cases in 34.33 seconds**.
The production-stack drill also passed using its bootstrap operator: a 54,042-byte
archive restored PostGIS, revision `0006_notifications`, two synthetic users and
four categories, then removed its isolated database. That separate production
fixture contained no vendors/visits; the business-row roundtrip above covers them.

```powershell
$env:RUN_DB_TESTS = '1'
$env:RUN_CONTAINER_TESTS = '1'
./.venv/Scripts/python.exe -m pytest -c backend/pyproject.toml backend/tests/test_backup_restore.py backend/tests/test_end_to_end.py -q
Remove-Item Env:RUN_DB_TESTS
Remove-Item Env:RUN_CONTAINER_TESTS
./infrastructure/scripts/Test-Production.ps1 -SkipBuild -CheckBackup
```

Provider delivery and public TLS remain separate checks. The visit workflow uses
a deterministic push stand-in and controlled test clocks; the browser workflow
separately exercised both real interfaces and six seconds between GPS fixes.
