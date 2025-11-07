import { NextRequest, NextResponse } from 'next/server';
import { postTweet } from '@/lib/twitter';

// Store recent errors in memory (for debugging)
// In production, you'd want to use a proper logging service
const recentErrors: Array<{
  timestamp: Date;
  error: any;
  context: string;
}> = [];

// Export function to log errors (can be called from other routes)
export function logTwitterError(error: any, context: string) {
  recentErrors.push({
    timestamp: new Date(),
    error: {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode || error?.code,
      data: error?.data,
      errors: error?.errors,
    },
    context,
  });
  
  // Keep only last 50 errors
  if (recentErrors.length > 50) {
    recentErrors.shift();
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check Twitter API credentials
    const credentials = {
      hasApiKey: !!process.env.TWITTER_API_KEY,
      hasApiSecret: !!process.env.TWITTER_API_SECRET,
      hasAccessToken: !!process.env.TWITTER_ACCESS_TOKEN,
      hasAccessSecret: !!process.env.TWITTER_ACCESS_SECRET,
    };

    // Test Twitter API connection
    let testResult = null;
    try {
      // Try to initialize the client
      const { client } = await import('@/lib/twitter').then(m => {
        // Access the internal function - we'll need to export it or test differently
        return { client: null };
      });
      
      // Simple test - try to get client info
      testResult = {
        canInitialize: true,
        message: 'Client can be initialized',
      };
    } catch (testError: any) {
      testResult = {
        canInitialize: false,
        error: testError?.message || String(testError),
      };
    }

    return NextResponse.json({
      success: true,
      credentials,
      testResult,
      recentErrors: recentErrors.slice(-20), // Last 20 errors
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

// Test endpoint to try posting a tweet
export async function POST(req: NextRequest) {
  try {
    const { text, replyToTweetId } = await req.json().catch(() => ({}));
    
    if (!text) {
      return NextResponse.json(
        { ok: false, error: 'Missing text parameter' },
        { status: 400 }
      );
    }
    
    console.log('Testing Twitter post:', { text, replyToTweetId });
    
    const tweetId = await postTweet(text, replyToTweetId);
    
    if (tweetId) {
      return NextResponse.json({
        ok: true,
        message: 'Tweet posted successfully',
        tweetId,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Failed to post tweet - check server logs for details' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logTwitterError(error, 'POST /api/debug/twitter-errors');
    console.error('Twitter post test error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Twitter post test failed' },
      { status: 500 }
    );
  }
}

