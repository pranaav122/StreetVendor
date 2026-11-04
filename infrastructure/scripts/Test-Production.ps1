param([switch]$SkipBuild, [switch]$CheckBackup)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskId = [guid]::NewGuid().ToString('N').Substring(0, 12)
$taskProject = "msv_prod_check_$taskId"
$taskEnvFile = Join-Path ([IO.Path]::GetTempPath()) "$taskProject.env"
$taskCompose = @('compose', '--project-name', $taskProject, '--env-file', $taskEnvFile,
    '-f', (Join-Path $taskRoot 'infrastructure/compose.production.yaml'))
function New-CheckSecret {
    [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64)).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}
function Invoke-CheckCompose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & docker @taskCompose @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Production container check failed. Read the safe output above.' }
}
try {
    # Generated settings are deliberately synthetic and never copied to a pilot.
    @"
POSTGRES_DB=$taskProject
BOOTSTRAP_PASSWORD=$(New-CheckSecret)
MIGRATION_PASSWORD=$(New-CheckSecret)
RUNTIME_PASSWORD=$(New-CheckSecret)
JWT_SECRET=$(New-CheckSecret)
MSV_IMAGE_TAG=local
API_DOMAIN=api.example.invalid
ADMIN_DOMAIN=admin.example.invalid
PUBLIC_CUSTOMER_URL=https://customer.example.invalid
PUBLIC_VENDOR_URL=https://partner.example.invalid
SMTP_HOST=smtp.example.invalid
SMTP_FROM=noreply@example.com
SERVICE_AREA_GEOJSON='{"type":"Polygon","coordinates":[[[80.15,13],[80.35,13],[80.35,13.2],[80.15,13.2],[80.15,13]]]}'
"@ | Set-Content -LiteralPath $taskEnvFile -Encoding utf8NoBOM
    Invoke-CheckCompose config --quiet
    if (-not $SkipBuild) { Invoke-CheckCompose build api admin }
    Invoke-CheckCompose up -d --wait db
    Invoke-CheckCompose run --rm migrate
    Invoke-CheckCompose up -d --wait api admin
    # Text source is safe to pipe; database dump bytes are never piped in PowerShell.
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'check_production.py') -Raw |
        & docker @taskCompose exec -T -e MSV_PRODUCTION_CHECK=1 api python -
    if ($LASTEXITCODE -ne 0) { throw 'Production permission/runtime probe failed.' }
    $taskApiLogs = & docker @taskCompose logs --no-log-prefix --no-color api
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect production request logs.' }
    if ($taskApiLogs -match 'must-not-be-logged|private_marker') { throw 'A private query value entered the logs.' }
    if (-not ($taskApiLogs -match '"event":"request_complete"')) { throw 'Structured request records are missing.' }
    Write-Output 'Structured API request logs omit query strings: ok'
    # Restart checks pool recovery and the deliberate loss of in-memory staff sessions.
    Invoke-CheckCompose restart db admin
    Invoke-CheckCompose up -d --wait db api admin
    Invoke-CheckCompose exec -T api python -c "import urllib.request; assert urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=10).status==200; print('PostgreSQL restart recovery: ok')"
    @'
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
path = Path('/tmp/msv-check-cookie')
try:
    request = Request('http://admin:3000/api/session', headers={'Cookie': path.read_text()})
    try:
        urlopen(request, timeout=10).close()
        raise AssertionError('Restarted admin retained a previous session.')
    except HTTPError as error:
        assert error.code == 401
    print('Admin restart requires a new login: ok')
finally:
    path.unlink(missing_ok=True)
'@ | & docker @taskCompose exec -T api python -
    if ($LASTEXITCODE -ne 0) { throw 'Admin restart session check failed.' }
    if ($CheckBackup) {
        $taskBackup = & (Join-Path $PSScriptRoot 'Backup-Database.ps1') -EnvFile $taskEnvFile `
            -ComposeFile (Join-Path $taskRoot 'infrastructure/compose.production.yaml') `
            -ProjectName $taskProject -OutputDirectory (Join-Path $taskRoot "backups/$taskProject")
        & (Join-Path $PSScriptRoot 'Test-Restore.ps1') -BackupPath $taskBackup.Path `
            -EnvFile $taskEnvFile -ComposeFile (Join-Path $taskRoot 'infrastructure/compose.production.yaml') `
            -ProjectName $taskProject -AsJson
    }
}
finally {
    if ($taskProject -notmatch '^msv_prod_check_[0-9a-f]{12}$') { throw 'Unsafe test cleanup target.' }
    # Only this run's generated project/volume may be removed, never development data.
    & docker @taskCompose down --volumes --remove-orphans
    if ($LASTEXITCODE -ne 0) { Write-Warning "Cleanup failed for generated project $taskProject; inspect it manually." }
    if (Test-Path -LiteralPath $taskEnvFile) { Remove-Item -LiteralPath $taskEnvFile }
}
