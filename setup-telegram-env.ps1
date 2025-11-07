# Script to help setup Telegram environment variables
# This will show you what to add to your .env.local file

$chatId = "-5099341317"
$botToken = "8502599070:AAFSR6-W27R1uQQ51K-BBTkHI_jCcDVM9FY"

Write-Host "`n=== Telegram Bot Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add these lines to your .env.local file:" -ForegroundColor Yellow
Write-Host ""
Write-Host "TELEGRAM_BOT_TOKEN=$botToken" -ForegroundColor Green
Write-Host "TELEGRAM_CHAT_ID=$chatId" -ForegroundColor Green
Write-Host ""
Write-Host "Or add them to your Vercel environment variables:" -ForegroundColor Yellow
Write-Host "  1. Go to Vercel Dashboard" -ForegroundColor White
Write-Host "  2. Select your project" -ForegroundColor White
Write-Host "  3. Go to Settings > Environment Variables" -ForegroundColor White
Write-Host "  4. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID" -ForegroundColor White
Write-Host ""

# Try to update .env.local if it exists
$envFile = ".env.local"
if (Test-Path $envFile) {
    Write-Host "Found .env.local file. Checking if Telegram variables are set..." -ForegroundColor Cyan
    
    $content = Get-Content $envFile -Raw
    $needsUpdate = $false
    
    if ($content -notmatch "TELEGRAM_BOT_TOKEN") {
        Write-Host "Adding TELEGRAM_BOT_TOKEN..." -ForegroundColor Yellow
        Add-Content $envFile "`n# Telegram Bot`nTELEGRAM_BOT_TOKEN=$botToken"
        $needsUpdate = $true
    } else {
        Write-Host "TELEGRAM_BOT_TOKEN already exists" -ForegroundColor Green
    }
    
    if ($content -notmatch "TELEGRAM_CHAT_ID") {
        Write-Host "Adding TELEGRAM_CHAT_ID..." -ForegroundColor Yellow
        Add-Content $envFile "TELEGRAM_CHAT_ID=$chatId"
        $needsUpdate = $true
    } else {
        Write-Host "TELEGRAM_CHAT_ID already exists, updating..." -ForegroundColor Yellow
        $content = $content -replace "TELEGRAM_CHAT_ID=.*", "TELEGRAM_CHAT_ID=$chatId"
        Set-Content $envFile $content
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Write-Host "`n✅ .env.local updated!" -ForegroundColor Green
        Write-Host "Note: Restart your dev server if it's running" -ForegroundColor Yellow
    } else {
        Write-Host "`n✅ .env.local already configured!" -ForegroundColor Green
    }
} else {
    Write-Host ".env.local not found. Creating it..." -ForegroundColor Yellow
    @"
# Telegram Bot
TELEGRAM_BOT_TOKEN=$botToken
TELEGRAM_CHAT_ID=$chatId
"@ | Out-File $envFile -Encoding utf8
    Write-Host "✅ Created .env.local with Telegram variables!" -ForegroundColor Green
}

Write-Host ""

