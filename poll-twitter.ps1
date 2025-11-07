$uri = "https://quasar.tips/api/twitter/poll"
$headers = @{ "Content-Type" = "application/json" }
$body = "{}"

# Twitter API rate limits: 300 requests per 15 minutes = 1 request every 3 seconds
# Use 30 seconds to be safe and avoid rate limits
$pollInterval = 30

Write-Host "Polling $uri every $pollInterval seconds. Press Ctrl+C to stop."
Write-Host "Note: Using $pollInterval second interval to avoid Twitter API rate limits (300 requests per 15 minutes)"

while ($true) {
  try {
    $res = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body -TimeoutSec 25
    
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] success=$($res.success) processed=$($res.processed)"
  } catch {
    $msg = $_.Exception.Message
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Warning "[$ts] Error: $msg"
    
    if ($_.Exception.Response) {
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Warning $errorBody
        
        # If rate limited, wait longer
        if ($errorBody -like "*429*" -or $errorBody -like "*rate limit*") {
          Write-Warning "[$ts] Rate limited! Waiting 5 minutes before retrying..."
          Start-Sleep -Seconds 300
          continue
        }
      } catch {}
    }
  }
  
  Start-Sleep -Seconds $pollInterval
}

