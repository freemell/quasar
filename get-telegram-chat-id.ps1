# Script to get Telegram chat ID
# 1. Add the bot to your Telegram group
# 2. Send any message in the group (e.g., "test")
# 3. Run this script

$uri = "https://quasar.tips/api/telegram/get-chat-id"

Write-Host "`n=== Getting Telegram Chat ID ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure you:" -ForegroundColor Yellow
Write-Host "  1. Added the bot to your Telegram group" -ForegroundColor White
Write-Host "  2. Sent a message in the group" -ForegroundColor White
Write-Host ""

try {
    $response = Invoke-RestMethod -Method Get -Uri $uri
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Chat IDs found:" -ForegroundColor Cyan
    if ($response.chatIds -and $response.chatIds.Length -gt 0) {
        foreach ($chatId in $response.chatIds) {
            Write-Host "  - $chatId" -ForegroundColor White
        }
        Write-Host ""
        Write-Host "Add this to your .env.local:" -ForegroundColor Yellow
        Write-Host "  TELEGRAM_CHAT_ID=$($response.chatIds[0])" -ForegroundColor Green
    } else {
        Write-Host "  No chat IDs found yet." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Instructions:" -ForegroundColor Cyan
        foreach ($instruction in $response.instructions) {
            Write-Host "  $instruction" -ForegroundColor White
        }
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host $errorBody -ForegroundColor Red
        } catch {}
    }
}

Write-Host ""

