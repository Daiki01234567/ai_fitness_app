param(
    [Parameter(Mandatory=$true)]
    [string]$EventType,
    
    [Parameter(Mandatory=$true)]
    [string]$WebhookUrl,
    
    [string]$Message = ""
)

$inputJson = ""
try {
    if ([Console]::In.Peek() -ne -1) {
        $inputJson = [Console]::In.ReadToEnd()
    }
} catch {}

if ($EventType -eq "Stop") {
    $notificationMessage = "Claude Code has finished processing"
    $embedColor = 5763719
}
elseif ($EventType -eq "Notification") {
    if ($inputJson) {
        try {
            $payload = $inputJson | ConvertFrom-Json
            $notificationMessage = $payload.message
        } catch {
            $notificationMessage = "Claude Code is waiting for input"
        }
    }
    else {
        $notificationMessage = "Claude Code is waiting for input"
    }
    $embedColor = 16776960
}
else {
    $notificationMessage = "Notification from Claude Code"
    $embedColor = 3447003
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    [System.Media.SystemSounds]::Asterisk.Play()
    [Console]::Beep(800, 300)
    Start-Sleep -Milliseconds 100
    [Console]::Beep(1000, 300)
} catch {}

try {
    $discordPayload = @{
        username = "Claude Code Bot"
        embeds = @(
            @{
                title = "Claude Code Notification"
                description = $notificationMessage
                color = $embedColor
                footer = @{
                    text = "Time: $timestamp"
                }
                fields = @(
                    @{
                        name = "Event Type"
                        value = $EventType
                        inline = $true
                    }
                )
            }
        )
    } | ConvertTo-Json -Depth 10

    Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $discordPayload -ContentType "application/json"
} catch {}