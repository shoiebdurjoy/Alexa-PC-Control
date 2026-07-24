$apps = @(
    "Chrome",
    "Brave",
    "VS Code",
    "Premiere Pro",
    "CapCut",
    "Discord",
    "Spotify",
    "Steam",
    "WhatsApp",
    "Messenger",
    "Notepad",
    "Calculator",
    "File Explorer",
    "Task Manager",
    "Command Prompt",
    "PowerShell"
)

$uri = "https://alexa-pc-control-backend.onrender.com/api/command"
$headers = @{
    "x-skill-secret" = "f984777facc7b8a0a521783d9897e4ad6709d034f508f0848803f1de20a5bd50"
    "Content-Type" = "application/json"
}

Write-Host "Starting E2E Regression Verification of all 16 applications..."
Write-Host "------------------------------------------------------------"

$results = @()

foreach ($app in $apps) {
    Write-Host "Testing Open for $app..."
    $bodyOpen = @{
        command = "OPEN_APP"
        params = @{ appName = $app }
    } | ConvertTo-Json

    $openPass = $false
    $openMsg = ""
    try {
        $respOpen = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $bodyOpen
        $openPass = $respOpen.success
        $openMsg = $respOpen.message
    } catch {
        $openPass = $false
        $openMsg = $_.Exception.Message
    }

    Start-Sleep -Seconds 3

    # For safety close testing of Notepad, we type something in it before closing
    if ($app -eq "Notepad" -and $openPass) {
        try {
            $ws = New-Object -ComObject Wscript.Shell
            if ($ws.AppActivate("Notepad")) {
                Start-Sleep -Seconds 0.5
                $ws.SendKeys("Unsaved changes test")
                Start-Sleep -Seconds 0.5
            }
        } catch {}
    }

    Write-Host "Testing Close for $app..."
    $bodyClose = @{
        command = "CLOSE_APP"
        params = @{ appName = $app }
    } | ConvertTo-Json

    $closePass = $false
    $closeMsg = ""
    try {
        $respClose = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $bodyClose
        # Safe apps returning safety prompt (allowForceKill = false) are counted as PASS
        if ($respClose.success -and ($respClose.message -like "*requires your confirmation*" -or $respClose.message -like "*Closed*")) {
            $closePass = $true
        } else {
            $closePass = $respClose.success
        }
        $closeMsg = $respClose.message
    } catch {
        $closePass = $false
        $closeMsg = $_.Exception.Message
    }

    # Clean up notepad if still open
    if ($app -eq "Notepad") {
        Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
    }

    $results += [PSCustomObject]@{
        Application = $app
        OpenStatus = if ($openPass) { "PASS" } else { "FAIL" }
        OpenDetails = $openMsg
        CloseStatus = if ($closePass) { "PASS" } else { "FAIL" }
        CloseDetails = $closeMsg
    }

    Start-Sleep -Seconds 2
}

Write-Host "`nE2E Regression Test Complete. Formatting results table..."
Write-Host "------------------------------------------------------------"

$results | Format-Table -AutoSize
