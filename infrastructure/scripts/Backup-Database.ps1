param(
    [string]$EnvFile = '.env',
    [string]$ComposeFile = 'infrastructure/compose.yaml',
    [string]$ProjectName = '',
    [string]$OutputDirectory = '',
    [ValidatePattern('^[a-zA-Z0-9_]+$')][string]$DatabaseName = '',
    [switch]$AsJson
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $taskRoot
$taskRemote = "/tmp/msv_backup_$([guid]::NewGuid().ToString('N')).dump"
$taskCompose = @('compose', '--env-file', (Resolve-Path -LiteralPath $EnvFile).Path,
    '-f', (Resolve-Path -LiteralPath $ComposeFile).Path)
if ($ProjectName) { $taskCompose += @('--project-name', $ProjectName) }
try {
    if (-not $OutputDirectory) { $OutputDirectory = Join-Path $taskRoot 'backups' }
    $null = New-Item -ItemType Directory -Path $OutputDirectory -Force
    $taskDestination = Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path (
        "mystreetvendor-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))-$([guid]::NewGuid().ToString('N')).dump")
    if (Test-Path -LiteralPath $taskDestination) { throw 'Refusing to overwrite a backup.' }
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'backup.sh') -Raw |
        & docker @taskCompose exec -T db sh -c 'tr -d "\r" | sh -s -- "$@"' sh $taskRemote $DatabaseName
    if ($LASTEXITCODE -ne 0) { throw 'Database dump failed; no usable backup was created.' }
    # Never use `docker ... pg_dump > file` in PowerShell: binary output can be decoded.
    & docker @taskCompose cp "db:$taskRemote" $taskDestination > $null
    if ($LASTEXITCODE -ne 0) { throw 'Copying the binary backup failed.' }
    $taskFile = Get-Item -LiteralPath $taskDestination
    if ($taskFile.Length -eq 0) { throw 'Backup is empty.' }
    $taskHash = (Get-FileHash -LiteralPath $taskDestination -Algorithm SHA256).Hash
    $taskResult = [pscustomobject]@{ Path = $taskFile.FullName; Bytes = $taskFile.Length; SHA256 = $taskHash }
    if ($AsJson) { $taskResult | ConvertTo-Json -Compress } else { $taskResult }
}
finally {
    # Only the generated temporary dump is removed. Existing host backups stay intact.
    & docker @taskCompose exec -T db rm -f -- $taskRemote
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Temporary dump cleanup failed; inspect the database container.' }
    Pop-Location
}
