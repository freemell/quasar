# Debug script to test Telegram bot and see detailed error

$botToken = "8502599070:AAFSR6-W27R1uQQ51K-BBTkHI_jCcDVM9FY"
$chatId = "-5099341317"

Write-Host "`n=== Testing Telegram Bot (Debug) ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check bot info
Write-Host "Test 1: Checking bot info..." -ForegroundColor Yellow
try {
    $url = "https://api.telegram.org/bot$botToken/getMe"
    $response = Invoke-RestMethod -Method Get -Uri $url
    if ($response.ok) {
        Write-Host "✅ Bot is valid:" -ForegroundColor Green
        Write-Host "  Username: @$($response.result.username)" -ForegroundColor Gray
        Write-Host "  First Name: $($response.result.first_name)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Bot token is invalid!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error checking bot: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Send simple message
Write-Host "Test 2: Sending simple message..." -ForegroundColor Yellow
$url = "https://api.telegram.org/bot$botToken/sendMessage"

$message = @{
    chat_id = $chatId
    text = "Test message from Quasar bot"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $message
    
    if ($response.ok) {
        Write-Host "✅ Message sent successfully!" -ForegroundColor Green
        Write-Host "  Message ID: $($response.result.message_id)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Check your Telegram group for the message!" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed: $($response.description)" -ForegroundColor Red
        Write-Host "Error code: $($response.error_code)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "Error details:" -ForegroundColor Red
            Write-Host $errorBody -ForegroundColor Red
        } catch {}
    }
}

Write-Host ""

