# Script to help understand the rate limit issue
Write-Host "`n=== Investigating Rate Limit Issue ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If your account was just created today and only has 2 posts," -ForegroundColor Yellow
Write-Host "but the daily limit shows 0/100 remaining, here are possible causes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Multiple API Keys in Same Project:" -ForegroundColor White
Write-Host "   - Check if you have multiple API keys/apps in the same project" -ForegroundColor Gray
Write-Host "   - Each API key might have its own limit, or they might share" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Failed Attempts Count:" -ForegroundColor White
Write-Host "   - Failed tweet attempts might still count toward the limit" -ForegroundColor Gray
Write-Host "   - Check your logs for failed postTweet calls" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Testing/Development Activity:" -ForegroundColor White
Write-Host "   - If you tested the system multiple times, each attempt counts" -ForegroundColor Gray
Write-Host "   - Even if tweets failed, they might count toward the limit" -ForegroundColor Gray
Write-Host ""
Write-Host "4. API Key Limit vs Account Limit:" -ForegroundColor White
Write-Host "   - The limit might be per API key/app, not per account" -ForegroundColor Gray
Write-Host "   - Check your Twitter Developer Portal for all API keys" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Rolling Window Issue:" -ForegroundColor White
Write-Host "   - The limit is a rolling 24-hour window" -ForegroundColor Gray
Write-Host "   - If you tested yesterday, those might still count" -ForegroundColor Gray
Write-Host ""
Write-Host "To check:" -ForegroundColor Cyan
Write-Host "1. Go to https://developer.x.com/en/portal/dashboard" -ForegroundColor White
Write-Host "2. Check your 'Default project' for all apps/API keys" -ForegroundColor White
Write-Host "3. Check your Twitter account settings for connected apps" -ForegroundColor White
Write-Host "4. Review your server logs for failed postTweet attempts" -ForegroundColor White
Write-Host ""

