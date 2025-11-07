import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import QueuedReply from '@/models/QueuedReply';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Count all queued replies (including failed attempts)
    const totalQueued = await QueuedReply.countDocuments({});
    const pendingQueued = await QueuedReply.countDocuments({ status: 'pending' });
    const completedQueued = await QueuedReply.countDocuments({ status: 'completed' });
    const failedQueued = await QueuedReply.countDocuments({ status: 'failed' });
    
    // Count attempts in the last 24 hours
    const recentAttempts = await QueuedReply.countDocuments({
      lastAttemptAt: { $gte: last24Hours }
    });
    
    // Get total attempts (sum of all attempts field)
    const allQueued = await QueuedReply.find({});
    const totalAttempts = allQueued.reduce((sum, q) => sum + (q.attempts || 0), 0);
    
    // Get queued replies created in last 24 hours
    const recentQueued = await QueuedReply.countDocuments({
      createdAt: { $gte: last24Hours }
    });
    
    return NextResponse.json({
      success: true,
      stats: {
        totalQueued,
        pendingQueued,
        completedQueued,
        failedQueued,
        recentAttempts,
        totalAttempts,
        recentQueued,
        message: `Total queued replies: ${totalQueued}. Total attempts: ${totalAttempts}. Recent attempts (24h): ${recentAttempts}.`
      },
      explanation: {
        note: "Each failed postTweet attempt might count toward the Twitter API daily limit, even if the tweet wasn't posted.",
        recommendation: "Check your server logs for all postTweet calls (both successful and failed) to see how many attempts were made."
      }
    });
  } catch (error: any) {
    console.error('Error getting usage stats:', error);
    return NextResponse.json({ 
      error: error?.message || String(error) 
    }, { status: 500 });
  }
}

