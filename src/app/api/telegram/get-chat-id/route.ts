import { NextRequest, NextResponse } from 'next/server';

// Simple endpoint to get chat ID
// Add the bot to your group, then send any message in the group
// Then call this endpoint to get the chat ID

export async function GET(request: NextRequest) {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ 
        error: 'TELEGRAM_BOT_TOKEN not configured' 
      }, { status: 400 });
    }

    // Get updates to find chat ID
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
    
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({ 
        error: 'Failed to get updates',
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.ok) {
      return NextResponse.json({ 
        error: 'Telegram API error',
        details: data
      }, { status: 400 });
    }

    // Extract unique chat IDs from updates
    const chatIds = new Set<number>();
    if (data.result && Array.isArray(data.result)) {
      for (const update of data.result) {
        if (update.message?.chat?.id) {
          chatIds.add(update.message.chat.id);
        }
        if (update.channel_post?.chat?.id) {
          chatIds.add(update.channel_post.chat.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'To get your chat ID: 1) Add the bot to your group, 2) Send a message in the group, 3) Call this endpoint again',
      chatIds: Array.from(chatIds),
      instructions: [
        '1. Add the bot to your Telegram group',
        '2. Send any message in the group (e.g., "test")',
        '3. Call this endpoint again to see the chat ID',
        '4. Add the chat ID to your .env.local as TELEGRAM_CHAT_ID'
      ]
    });
  } catch (error: any) {
    console.error('Error getting chat ID:', error);
    return NextResponse.json({ 
      error: error?.message || String(error) 
    }, { status: 500 });
  }
}

