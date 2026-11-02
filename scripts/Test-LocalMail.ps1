param([string]$ApiUrl = 'http://127.0.0.1:8000', [string]$InboxUrl = 'http://127.0.0.1:8025')
$ErrorActionPreference = 'Stop'
$taskEmail = "mail-check-$([guid]::NewGuid().ToString('N'))@example.com"
$taskPassword = "Test-$([guid]::NewGuid())"
$taskNewPassword = "Reset-$([guid]::NewGuid())"

function Invoke-ApiPost($Path, $Body) {
    Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/v1/$Path" -ContentType 'application/json' -Body ($Body | ConvertTo-Json)
}

# Synthetic credentials stay in memory; never print recovery tokens or mail bodies.
$null = Invoke-ApiPost 'auth/register/customer' @{email=$taskEmail; password=$taskPassword; display_name='Mail check'}
$null = Invoke-ApiPost 'auth/password/reset/request' @{email=$taskEmail}
$taskMessage = $null
for ($taskAttempt = 0; $taskAttempt -lt 15; $taskAttempt++) {
    $taskInbox = Invoke-RestMethod "$InboxUrl/api/v1/messages"
    # Enumerate recipients explicitly: Array.Address is a .NET method in PowerShell.
    $taskMessage = $taskInbox.messages | Where-Object {
        @($_.To | Where-Object { $_.Address -eq $taskEmail }).Count -gt 0
    } | Select-Object -First 1
    if ($taskMessage) { break }
    Start-Sleep -Milliseconds 300
}
if (-not $taskMessage) { throw 'No matching message reached the local SMTP inbox.' }
$taskMail = Invoke-RestMethod "$InboxUrl/api/v1/message/$($taskMessage.ID)"
if ($taskMail.Text -notmatch '#token=([A-Za-z0-9_-]+)') { throw 'Message lacks a recovery link.' }
$taskToken = $Matches[1]
$null = Invoke-ApiPost 'auth/password/reset/confirm' @{token=$taskToken; password=$taskNewPassword}
$taskSession = Invoke-ApiPost 'auth/login' @{email=$taskEmail; password=$taskNewPassword}
$null = Invoke-RestMethod -Method Delete -Uri "$ApiUrl/api/v1/users/me" -Headers @{Authorization="Bearer $($taskSession.access_token)"} -ContentType 'application/json' -Body '{"confirmation":"DELETE"}'
Write-Output 'PASS: real local SMTP capture, password reset, new-password login and synthetic-account deletion.'
