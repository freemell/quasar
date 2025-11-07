import { NextRequest, NextResponse } from 'next/server';
import { postTweet } from '@/lib/twitter';

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
        tweetId
      });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Failed to post tweet - check server logs for details' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Twitter post test error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Twitter post test failed' },
      { status: 500 }
    );
  }
}

