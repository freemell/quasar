import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage, sendTwitterReplyToTelegram } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    // Test 1: Simple message
    const testMessage1 = await sendTelegramMessage('🧪 <b>Test Message</b>\n\nThis is a test message from the Quasar bot!');
    
    // Test 2: Twitter reply format
    const testMessage2 = await sendTwitterReplyToTelegram(
      '@testuser pay from @sender A 0.001 BNB tip has been sent to your wallet! Tx: https://bscscan.com/tx/0x123...',
      '1234567890',
      '0x1234567890abcdef1234567890abcdef12345678'
    );
    
    if (testMessage1 || testMessage2) {
      return NextResponse.json({
        success: true,
        message: 'Test messages sent to Telegram',
        results: {
          simpleMessage: testMessage1,
          twitterReplyFormat: testMessage2
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to send test messages. Check your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.'
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error testing Telegram bot:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || String(error)
    }, { status: 500 });
  }
}

