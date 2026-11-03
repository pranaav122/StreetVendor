$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPython = Join-Path $taskRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
    throw 'Create the project Python environment using the README instructions first.'
}
$taskPreviousDbFlag = $env:RUN_DB_TESTS
Push-Location $taskRoot
try {
    # The test creates a unique disposable database; it leaves development accounts alone.
    $env:RUN_DB_TESTS = '1'
    & $taskPython -m pytest -c backend/pyproject.toml backend/tests/test_end_to_end.py -q
    if ($LASTEXITCODE -ne 0) { throw 'The synthetic visit workflow failed. Read the test output above.' }
}
finally {
    $env:RUN_DB_TESTS = $taskPreviousDbFlag
    Pop-Location
}
