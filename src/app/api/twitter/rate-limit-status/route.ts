import { NextRequest, NextResponse } from 'next/server';
import { getPostTweetRateLimitResetTime } from '@/lib/twitter';
import connectDB from '@/lib/mongodb';
import QueuedReply from '@/models/QueuedReply';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const resetTime = getPostTweetRateLimitResetTime();
    const now = new Date();
    
    let status = {
      isRateLimited: false,
      resetTime: null as Date | null,
      resetTimeISO: null as string | null,
      waitTimeMs: 0,
      waitTimeMinutes: 0,
      waitTimeHours: 0,
      waitTimeFormatted: '',
      canPostNow: true
    };
    
    if (resetTime && resetTime > now) {
      status.isRateLimited = true;
      status.resetTime = resetTime;
      status.resetTimeISO = resetTime.toISOString();
      status.waitTimeMs = resetTime.getTime() - now.getTime();
      status.waitTimeMinutes = Math.ceil(status.waitTimeMs / 60000);
      status.waitTimeHours = Math.ceil(status.waitTimeMs / 3600000);
      status.canPostNow = false;
      
      // Format wait time
      const hours = Math.floor(status.waitTimeMs / 3600000);
      const minutes = Math.floor((status.waitTimeMs % 3600000) / 60000);
      const seconds = Math.floor((status.waitTimeMs % 60000) / 1000);
      
      if (hours > 0) {
        status.waitTimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        status.waitTimeFormatted = `${minutes}m ${seconds}s`;
      } else {
        status.waitTimeFormatted = `${seconds}s`;
      }
    }
    
    // Get queue stats
    const queuedCount = await QueuedReply.countDocuments({ status: 'pending' });
    const readyToRetry = await QueuedReply.countDocuments({
      status: 'pending',
      nextRetryAt: { $lte: now }
    });
    
    return NextResponse.json({
      success: true,
      rateLimit: status,
      queue: {
        pending: queuedCount,
        readyToRetry,
        message: queuedCount > 0 
          ? `There are ${queuedCount} replies queued. ${readyToRetry} are ready to retry now.`
          : 'No replies in queue.'
      },
      currentTime: now.toISOString()
    });
  } catch (error: any) {
    console.error('Error getting rate limit status:', error);
    return NextResponse.json({ 
      error: error?.message || String(error) 
    }, { status: 500 });
  }
}

