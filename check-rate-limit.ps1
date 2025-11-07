# Quick script to check rate limit status
$uri = "https://quasar.tips/api/twitter/rate-limit-status"

try {
    $status = Invoke-RestMethod -Method Get -Uri $uri
    
    Write-Host "`n=== Rate Limit Status ===" -ForegroundColor Cyan
    Write-Host "Rate Limited: $($status.rateLimit.isRateLimited)" -ForegroundColor $(if ($status.rateLimit.isRateLimited) { "Red" } else { "Green" })
    Write-Host "Can Post Now: $($status.rateLimit.canPostNow)" -ForegroundColor $(if ($status.rateLimit.canPostNow) { "Green" } else { "Red" })
    
    if ($status.rateLimit.isRateLimited) {
        Write-Host "`nReset Time: $($status.rateLimit.resetTimeISO)" -ForegroundColor Yellow
        Write-Host "Wait Time: $($status.rateLimit.waitTimeFormatted)" -ForegroundColor Yellow
        Write-Host "Wait Hours: $($status.rateLimit.waitTimeHours)" -ForegroundColor Yellow
    }
    
    Write-Host "`n=== Queue Status ===" -ForegroundColor Cyan
    Write-Host "Pending Replies: $($status.queue.pending)" -ForegroundColor $(if ($status.queue.pending -gt 0) { "Yellow" } else { "Green" })
    Write-Host "Ready to Retry: $($status.queue.readyToRetry)" -ForegroundColor $(if ($status.queue.readyToRetry -gt 0) { "Green" } else { "Gray" })
    Write-Host $status.queue.message
    
    Write-Host "`nCurrent Time: $($status.currentTime)" -ForegroundColor Gray
} catch {
    Write-Host "Error checking status: $($_.Exception.Message)" -ForegroundColor Red
}

