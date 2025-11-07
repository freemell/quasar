import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User, { IPendingClaim } from '@/models/User';
import { postTweet } from '@/lib/twitter';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { userId, tipId } = await request.json();
    
    if (!userId || !tipId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId and tipId' },
        { status: 400 }
      );
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find the pending claim
    const pendingClaim = user.pendingClaims.find((claim: IPendingClaim) => claim._id?.toString() === tipId);
    if (!pendingClaim) {
      return NextResponse.json(
        { error: 'Pending claim not found' },
        { status: 404 }
      );
    }

    // Check if user has custodial wallet (tips are sent to custodial wallet)
    if (!user.encryptedPrivateKey || !user.walletAddress) {
      return NextResponse.json(
        { error: 'User must have a custodial wallet to claim tips' },
        { status: 400 }
      );
    }

    // The tip is already in the custodial wallet, so "claiming" just means marking it as claimed
    // If we want to transfer to an embedded wallet, we'd need the embedded wallet address
    // For now, we'll just mark it as claimed since funds are already in the custodial wallet

    // Add to transaction history (the tip was already received, we're just acknowledging it)
    user.history.push({
      type: 'tip',
      amount: pendingClaim.amount,
      token: pendingClaim.token as 'BNB' | 'USDC',
      counterparty: pendingClaim.sender,
      txHash: pendingClaim.fromTx || `claimed_${Date.now()}`,
      date: new Date()
    });

    // Remove from pending claims
    user.pendingClaims = user.pendingClaims.filter((claim: IPendingClaim) => claim._id?.toString() !== tipId);

    await user.save();

    // Post tweet about claim (if original tweet ID exists)
    const username = user.handle.replace(/^@/, '');
    try {
      if (pendingClaim.fromTx && !pendingClaim.fromTx.startsWith('https://')) {
        // If fromTx is a tweet ID (not a URL), reply to it
        const replyId = await postTweet(`@${username} has claimed their tip after signing up on quasar.tips`, pendingClaim.fromTx);
        if (!replyId) {
          console.error(`Failed to post claim tweet reply to ${pendingClaim.fromTx}`);
        }
      }
    } catch (e) {
      console.error('Failed to post claim tweet:', e);
      // Don't fail the claim if tweet posting fails
    }

    return NextResponse.json({
      success: true,
      txHash: pendingClaim.fromTx || `claimed_${Date.now()}`,
      message: 'Tip claimed successfully'
    });

  } catch (e: any) {
    const message = e?.message || String(e);
    console.error('Claim tip error:', message);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


