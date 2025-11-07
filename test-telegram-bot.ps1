# Simple script to test Telegram bot integration
# Tests sending a message to your Telegram group

$uri = "https://quasar.tips/api/telegram/test"

Write-Host "`n=== Testing Telegram Bot ===" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body "{}"
    
    if ($response.success) {
        Write-Host "✅ Test message sent successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check your Telegram group for the test message." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Test failed: $($response.error)" -ForegroundColor Red
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

