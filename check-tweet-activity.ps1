# Script to help understand the rate limit situation
Write-Host "`n=== Understanding Your Rate Limit ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "The daily user limit (100/day) includes ALL tweets from @Quasartip account:" -ForegroundColor Yellow
Write-Host "  - Tweets from this app (Quasar bot)" -ForegroundColor White
Write-Host "  - Manual tweets you posted" -ForegroundColor White
Write-Host "  - Tweets from other apps/services" -ForegroundColor White
Write-Host "  - Testing tweets" -ForegroundColor White
Write-Host "  - ANY tweets from the @Quasartip account" -ForegroundColor White
Write-Host ""
Write-Host "The monthly post cap (9 posts) only counts posts from THIS app." -ForegroundColor Yellow
Write-Host ""
Write-Host "If you sent 100+ tweets from @Quasartip in the last 24 hours (from any source)," -ForegroundColor Red
Write-Host "the daily limit will be exhausted, even if only 9 were from this app." -ForegroundColor Red
Write-Host ""
Write-Host "To check your account's tweet activity:" -ForegroundColor Cyan
Write-Host "  1. Go to https://x.com/Quasartip" -ForegroundColor White
Write-Host "  2. Check your recent tweets" -ForegroundColor White
Write-Host "  3. Count tweets from the last 24 hours" -ForegroundColor White
Write-Host ""
Write-Host "The daily limit resets when the oldest tweet in the 24-hour window expires." -ForegroundColor Yellow
Write-Host ""

