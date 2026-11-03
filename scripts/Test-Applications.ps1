param([Parameter(ValueFromRemainingArguments = $true)][string[]]$TestPaths)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPython = Join-Path $taskRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Create the project Python environment first.' }
$taskPreviousPythonPath = $env:PYTHONPATH
Push-Location $taskRoot
try {
    $env:PYTHONPATH = Join-Path $taskRoot 'backend'
    & $taskPython backend/scripts/run_browser_tests.py @TestPaths
    if ($LASTEXITCODE -ne 0) { throw 'Application checks failed. Read the test output above.' }
}
finally {
    $env:PYTHONPATH = $taskPreviousPythonPath
    Pop-Location
}
