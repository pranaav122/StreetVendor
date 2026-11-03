param([Parameter(ValueFromRemainingArguments = $true)][string[]]$TestPaths)
npm run test:ui -- @TestPaths
exit $LASTEXITCODE
