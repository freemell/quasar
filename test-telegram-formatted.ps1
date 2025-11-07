# Test formatted message (like what will be sent from the poll route)

$botToken = "8502599070:AAFSR6-W27R1uQQ51K-BBTkHI_jCcDVM9FY"
$chatId = "-5099341317"

Write-Host "`n=== Testing Formatted Telegram Message ===" -ForegroundColor Cyan
Write-Host ""

$url = "https://api.telegram.org/bot$botToken/sendMessage"

$message = @{
    chat_id = $chatId
    text = "🐦 <b>Twitter Reply Needed</b>`n`n<b>Reply Text:</b>`n@millw11488 pay from @witchmillaa A 0.001 BNB tip has been sent to your wallet! Claim it when you sign up on quasar.tips. Tx: https://bscscan.com/tx/0xf286809b5285e6eff168ae87fcb0047908ccfc91916e50952ecf253a8b846c54`n`n<b>Tweet ID:</b> <code>1986784030243668398</code>`n<b>Transaction:</b> <a href=`"https://bscscan.com/tx/0xf286809b5285e6eff168ae87fcb0047908ccfc91916e50952ecf253a8b846c54`">0xf286809b5285e6eff168ae87fcb0047908ccfc91916e50952ecf253a8b846c54</a>`n`n<b>Twitter Link:</b> <a href=`"https://x.com/i/web/status/1986784030243668398`">View Tweet</a>"
    parse_mode = "HTML"
    disable_web_page_preview = $false
} | ConvertTo-Json

try {
    Write-Host "Sending formatted message..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $message
    
    if ($response.ok) {
        Write-Host "✅ Formatted message sent successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check your Telegram group for the formatted message." -ForegroundColor Yellow
        Write-Host "This is how Twitter replies will look when rate limited." -ForegroundColor Gray
    } else {
        Write-Host "❌ Failed: $($response.description)" -ForegroundColor Red
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

