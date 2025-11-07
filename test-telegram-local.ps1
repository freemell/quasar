# Local test script that uses your .env.local file
# This tests the Telegram bot directly using your local environment

Write-Host "`n=== Testing Telegram Bot (Local) ===" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env.local
if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local"
    foreach ($line in $envContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "❌ .env.local not found!" -ForegroundColor Red
    Write-Host "Run .\setup-telegram-env.ps1 first" -ForegroundColor Yellow
    exit 1
}

$botToken = $env:TELEGRAM_BOT_TOKEN
$chatId = $env:TELEGRAM_CHAT_ID

if (-not $botToken -or -not $chatId) {
    Write-Host "❌ Telegram bot not configured!" -ForegroundColor Red
    Write-Host "Missing:" -ForegroundColor Yellow
    if (-not $botToken) { Write-Host "  - TELEGRAM_BOT_TOKEN" -ForegroundColor Red }
    if (-not $chatId) { Write-Host "  - TELEGRAM_CHAT_ID" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Run .\setup-telegram-env.ps1 to configure" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found Telegram configuration:" -ForegroundColor Green
Write-Host "  Bot Token: $($botToken.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "  Chat ID: $chatId" -ForegroundColor Gray
Write-Host ""

# Test sending a message
$url = "https://api.telegram.org/bot$botToken/sendMessage"

$message = @{
    chat_id = $chatId
    text = "🧪 <b>Test Message</b>`n`nThis is a test message from the Quasar bot!`n`nIf you see this, the bot is working correctly! ✅"
    parse_mode = "HTML"
} | ConvertTo-Json

try {
    Write-Host "Sending test message..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $message
    
    if ($response.ok) {
        Write-Host "✅ Test message sent successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check your Telegram group for the test message." -ForegroundColor Yellow
        Write-Host "Message ID: $($response.result.message_id)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Failed to send message: $($response.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "Error details: $errorBody" -ForegroundColor Red
        } catch {}
    }
}

Write-Host ""

