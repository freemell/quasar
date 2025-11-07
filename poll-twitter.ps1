$uri = "https://quasar.tips/api/twitter/poll"
$headers = @{ "Content-Type" = "application/json" }
$body = "{}"

Write-Host "Polling $uri every 5 seconds. Press Ctrl+C to stop."

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
        Write-Warning ($reader.ReadToEnd())
      } catch {}
    }
  }
  
  Start-Sleep -Seconds 5
}

