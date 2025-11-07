# Telegram Bot Setup Guide

## Quick Setup

1. **Add the bot to your Telegram group:**
   - Open Telegram
   - Create a group or use an existing one
   - Add the bot: `@YourBotUsername` (or search by token)
   - Make the bot an admin (optional, but recommended)

2. **Get the Chat ID:**
   - Send any message in the group (e.g., "test")
   - Call: `GET https://quasar.tips/api/telegram/get-chat-id`
   - Or use PowerShell: `Invoke-RestMethod -Method Get -Uri "https://quasar.tips/api/telegram/get-chat-id"`
   - Copy the chat ID from the response

3. **Add to .env.local:**
   ```env
   TELEGRAM_BOT_TOKEN=8502599070:AAFSR6-W27R1uQQ51K-BBTkHI_jCcDVM9FY
   TELEGRAM_CHAT_ID=YOUR_CHAT_ID_HERE
   ```

4. **Deploy to Vercel:**
   - Add the environment variables in Vercel dashboard
   - Redeploy

## How It Works

- When Twitter posting fails (rate limited), the reply is automatically sent to your Telegram group
- You can copy/paste the reply text and post it manually on Twitter
- The system will still queue the reply for automatic retry when the limit resets

## Message Format

The Telegram message includes:
- Reply text (ready to copy/paste)
- Tweet ID
- Transaction hash (with BscScan link)
- Twitter link (to view the original tweet)

## Testing

Test the bot by calling:
```powershell
Invoke-RestMethod -Method Get -Uri "https://quasar.tips/api/telegram/get-chat-id"
```

Or visit: `https://quasar.tips/api/telegram/get-chat-id`

