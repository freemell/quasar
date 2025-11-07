import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import QueuedReply from '@/models/QueuedReply';
import { postTweet, getPostTweetRateLimitResetTime } from '@/lib/twitter';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const now = new Date();
    
    // Find all queued replies that are ready to retry
    const queuedReplies = await QueuedReply.find({
      status: 'pending',
      nextRetryAt: { $lte: now }
    }).sort({ nextRetryAt: 1 }).limit(10); // Process up to 10 at a time
    
    if (queuedReplies.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No queued replies ready to retry',
        processed: 0 
      });
    }
    
    console.log(`🔄 Processing ${queuedReplies.length} queued replies...`);
    
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    
    for (const queuedReply of queuedReplies) {
      try {
        // Mark as processing
        queuedReply.status = 'processing';
        queuedReply.lastAttemptAt = new Date();
        queuedReply.attempts += 1;
        await queuedReply.save();
        
        // Try to post the reply
        const replyId = await postTweet(queuedReply.replyText, queuedReply.replyToTweetId);
        
        if (replyId) {
          // Success! Mark as completed
          queuedReply.status = 'completed';
          await queuedReply.save();
          succeeded++;
          console.log(`✅ Successfully posted queued reply ${replyId} for tweet ${queuedReply.tweetId}`);
        } else {
          // Failed - check if we're rate limited
          const resetTime = getPostTweetRateLimitResetTime();
          const nextRetryAt = resetTime && resetTime > new Date() 
            ? resetTime 
            : new Date(Date.now() + 15 * 60 * 1000); // Default to 15 minutes
          
          queuedReply.status = 'pending';
          queuedReply.nextRetryAt = nextRetryAt;
          queuedReply.error = 'Rate limited or API error';
          await queuedReply.save();
          failed++;
          console.log(`⏳ Queued reply for tweet ${queuedReply.tweetId} will retry at ${nextRetryAt.toISOString()}`);
        }
        
        processed++;
      } catch (error: any) {
        // Error during processing - queue for retry
        const resetTime = getPostTweetRateLimitResetTime();
        const nextRetryAt = resetTime && resetTime > new Date() 
          ? resetTime 
          : new Date(Date.now() + 15 * 60 * 1000);
        
        queuedReply.status = 'pending';
        queuedReply.nextRetryAt = nextRetryAt;
        queuedReply.error = error?.message || String(error);
        queuedReply.attempts += 1;
        await queuedReply.save();
        failed++;
        console.error(`❌ Error processing queued reply for tweet ${queuedReply.tweetId}:`, error);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      processed,
      succeeded,
      failed,
      message: `Processed ${processed} queued replies: ${succeeded} succeeded, ${failed} failed/requeued`
    });
  } catch (error: any) {
    console.error('Error retrying queued replies:', error);
    return NextResponse.json({ 
      error: error?.message || String(error) 
    }, { status: 500 });
  }
}

// Also allow GET to check queue status
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const pending = await QueuedReply.countDocuments({ status: 'pending' });
    const processing = await QueuedReply.countDocuments({ status: 'processing' });
    const completed = await QueuedReply.countDocuments({ status: 'completed' });
    const failed = await QueuedReply.countDocuments({ status: 'failed' });
    
    const readyToRetry = await QueuedReply.countDocuments({
      status: 'pending',
      nextRetryAt: { $lte: new Date() }
    });
    
    return NextResponse.json({
      success: true,
      queue: {
        pending,
        processing,
        completed,
        failed,
        readyToRetry,
        total: pending + processing + completed + failed
      }
    });
  } catch (error: any) {
    console.error('Error getting queue status:', error);
    return NextResponse.json({ 
      error: error?.message || String(error) 
    }, { status: 500 });
  }
}

