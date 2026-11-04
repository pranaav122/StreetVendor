param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
    [string]$ExpectedRevision = '0006_notifications',
    [string]$EnvFile = '.env',
    [string]$ComposeFile = 'infrastructure/compose.yaml',
    [string]$ProjectName = '',
    [switch]$AsJson
)
$ErrorActionPreference = 'Stop'
# Validate input before Docker/configuration, so a bad path cannot start any work.
if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) { throw 'Backup file does not exist.' }
$taskBackup = (Resolve-Path -LiteralPath $BackupPath).Path
if ((Get-Item -LiteralPath $taskBackup).Length -eq 0) { throw 'Backup file is empty.' }
$taskRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskTarget = "msv_restore_$([guid]::NewGuid().ToString('N'))"
$taskRemote = "/tmp/$taskTarget.dump"
Push-Location $taskRoot
$taskCompose = @('compose', '--env-file', (Resolve-Path -LiteralPath $EnvFile).Path,
    '-f', (Resolve-Path -LiteralPath $ComposeFile).Path)
if ($ProjectName) { $taskCompose += @('--project-name', $ProjectName) }
try {
    & docker @taskCompose cp $taskBackup "db:$taskRemote" > $null
    if ($LASTEXITCODE -ne 0) { throw 'Copying the binary backup into the database container failed.' }
    $taskOutput = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'restore-check.sh') -Raw |
        & docker @taskCompose exec -T db sh -c 'tr -d "\r" | sh -s -- "$@"' sh $taskTarget $taskRemote $ExpectedRevision
    if ($LASTEXITCODE -ne 0) { throw 'Isolated restore or validation failed.' }
    $taskResult = ($taskOutput -join "`n") | ConvertFrom-Json
    if ($taskResult.postgis -ne 'ok' -or $taskResult.revision -ne $ExpectedRevision) {
        throw 'Restored PostGIS/revision validation failed.'
    }
    $taskResult | Add-Member -NotePropertyName isolated_target_removed -NotePropertyValue $taskTarget
    if ($AsJson) { $taskResult | ConvertTo-Json -Compress } else { $taskResult }
}
finally {
    & docker @taskCompose exec -T db rm -f -- $taskRemote
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Temporary restore file cleanup failed; inspect the database container.' }
    Pop-Location
}
