// Simple Telegram bot utility for sending messages
// Uses HTTP requests (no long polling) for Vercel serverless compatibility

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramMessage(text: string): Promise<boolean> {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn('⚠️ Telegram bot not configured. Missing:', {
        hasBotToken: !!TELEGRAM_BOT_TOKEN,
        hasChatId: !!TELEGRAM_CHAT_ID
      });
      console.warn('⚠️ Make sure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in your environment variables');
      return false;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML', // Allow HTML formatting
        disable_web_page_preview: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Telegram API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return false;
    }

    const data = await response.json();
    if (data.ok) {
      console.log('✅ Telegram message sent successfully');
      return true;
    } else {
      console.error('❌ Telegram API returned error:', data);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error sending Telegram message:', error);
    return false;
  }
}

export async function sendTwitterReplyToTelegram(
  replyText: string,
  tweetId: string,
  txHash: string
): Promise<boolean> {
  try {
    // Escape HTML special characters in replyText
    const escapedReplyText = replyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Format message for Telegram
    const message = `🐦 <b>Twitter Reply Needed</b>\n\n` +
      `<b>Reply Text:</b>\n<code>${escapedReplyText}</code>\n\n` +
      `<b>Tweet ID:</b> <code>${tweetId}</code>\n` +
      `<b>Transaction:</b> <a href="https://bscscan.com/tx/${txHash}">View on BscScan</a>\n\n` +
      `<b>Twitter Link:</b> <a href="https://x.com/i/web/status/${tweetId}">View Tweet</a>`;

    return await sendTelegramMessage(message);
  } catch (error: any) {
    console.error('❌ Error sending Twitter reply to Telegram:', error);
    return false;
  }
}

