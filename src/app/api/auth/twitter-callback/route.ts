import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getUserProfile } from '@/lib/twitter';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { privyUserId, twitterId, accessToken } = await request.json();
    
    if (!privyUserId || !twitterId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Fetch user profile from Twitter API
    const twitterUser = await getUserProfile(twitterId);
    
    if (!twitterUser) {
      return NextResponse.json(
        { error: 'Failed to fetch Twitter profile' },
        { status: 400 }
      );
    }

    // Check if user already exists
    let user = await User.findOne({ twitterId });
    
    if (user) {
      // Update existing user with latest Twitter data
      user.name = twitterUser.name;
      user.handle = `@${twitterUser.username}`;
      user.profileImage = twitterUser.profile_image_url;
      user.bio = twitterUser.description || '';
      await user.save();
    } else {
      // Create new user
      user = new User({
        twitterId,
        handle: `@${twitterUser.username}`,
        name: twitterUser.name,
        profileImage: twitterUser.profile_image_url,
        bio: twitterUser.description || '',
        walletAddress: '', // Will be set by custodial wallet creation
        isEmbedded: false,
        history: [],
        pendingClaims: []
      });
      await user.save();
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        twitterId: user.twitterId,
        handle: user.handle,
        name: user.name,
        profileImage: user.profileImage,
        bio: user.bio,
        walletAddress: user.walletAddress,
        isEmbedded: user.isEmbedded,
        pendingClaims: user.pendingClaims
      }
    });

  } catch (error) {
    console.error('Twitter callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


