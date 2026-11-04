param([switch]$Browser, [switch]$Production, [switch]$NativeBundles)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskPreviousDbTests = $env:RUN_DB_TESTS
$taskPreviousContainerTests = $env:RUN_CONTAINER_TESTS
$taskPreviousAdminBuild = $env:TEST_ADMIN_PRODUCTION
$taskPreviousTelemetry = $env:NEXT_TELEMETRY_DISABLED
function Invoke-StackCheck {
    param([string]$Program, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Check failed: $Program $($Arguments -join ' ')" }
}
Push-Location $taskRoot
try {
    $taskDockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
    if (Test-Path -LiteralPath $taskDockerBin) { $env:PATH = "$taskDockerBin;$env:PATH" }
    $taskPython = Join-Path $taskRoot '.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Create the project Python environment first.' }
    Write-Output 'Checking local Docker services and rebuilding the current API.'
    Invoke-StackCheck docker compose --env-file .env -f infrastructure/compose.yaml config --quiet
    Invoke-StackCheck docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait db mail
    Invoke-StackCheck docker compose --env-file .env -f infrastructure/compose.yaml build api
    Invoke-StackCheck docker compose --env-file .env -f infrastructure/compose.yaml run --rm api alembic -c alembic.ini upgrade head
    Invoke-StackCheck docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait api
    $taskHealth = Invoke-RestMethod 'http://127.0.0.1:8000/health'
    if ($taskHealth.status -ne 'ok' -or $taskHealth.postgis -ne 'ok') { throw 'Local readiness check failed.' }
    Write-Output 'Running the full backend suite, including real database/container/restore checks.'
    $env:RUN_DB_TESTS = '1'
    $env:RUN_CONTAINER_TESTS = '1'
    Invoke-StackCheck $taskPython -m pytest -c backend/pyproject.toml backend/tests -q
    foreach ($taskSuite in @('test:client', 'test:customer', 'test:partner', 'test:admin', 'check:design', 'typecheck')) {
        Invoke-StackCheck npm run $taskSuite
    }
    foreach ($taskApp in @('customer-app', 'vendor-app', 'admin-dashboard')) {
        Invoke-StackCheck npm run typecheck --workspace "@mystreetvendor/$taskApp"
    }
    $env:NEXT_TELEMETRY_DISABLED = '1'
    Invoke-StackCheck npm run build --workspace '@mystreetvendor/admin-dashboard'
    foreach ($taskApp in @('customer-app', 'vendor-app')) {
        Push-Location (Join-Path $taskRoot "apps/$taskApp")
        try {
            Invoke-StackCheck npx expo install --check
            Invoke-StackCheck npx expo-doctor
            if ($NativeBundles) {
                $taskExport = Join-Path $taskRoot ".superpowers/sdd/2026-11-02-operations/$taskApp-export"
                Invoke-StackCheck npx expo export --platform all --output-dir $taskExport
            }
        }
        finally { Pop-Location }
    }
    if ($Browser) {
        $env:TEST_ADMIN_PRODUCTION = '1'
        & (Join-Path $taskRoot 'scripts/Test-Applications.ps1')
    }
    else { Write-Output 'Browser checks not requested; rerun with -Browser to include them.' }
    if ($Production) { & (Join-Path $PSScriptRoot 'Test-Production.ps1') -CheckBackup }
    else { Write-Output 'Production-container checks not requested; rerun with -Production to include them.' }
    Write-Output 'Requested local stack checks passed. Physical-device/provider/public-TLS checks are separate.'
}
finally {
    $env:RUN_DB_TESTS = $taskPreviousDbTests
    $env:RUN_CONTAINER_TESTS = $taskPreviousContainerTests
    $env:TEST_ADMIN_PRODUCTION = $taskPreviousAdminBuild
    $env:NEXT_TELEMETRY_DISABLED = $taskPreviousTelemetry
    Pop-Location
}
