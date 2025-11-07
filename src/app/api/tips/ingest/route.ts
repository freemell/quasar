import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { ethers } from 'ethers';
import { encryptPrivateKey } from '@/lib/crypto';

// POST /api/tips/ingest
// Body: { senderHandle: string, recipientHandle: string, amount: number, token?: 'BNB'|'USDC', tweetId: string }
// Creates recipient if missing (custodial wallet), records a pending claim on recipient
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { senderHandle, recipientHandle, amount, token = 'BNB', tweetId } = await req.json();
    if (!senderHandle || !recipientHandle || !amount || !tweetId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const norm = (h: string) => (h.startsWith('@') ? h : `@${h}`);
    const senderH = norm(senderHandle);
    const recipientH = norm(recipientHandle);

    // Ensure sender exists (may be an app user or not). If not, create a shell record without custodial key
    let sender = await User.findOne({ handle: senderH });
    if (!sender) {
      sender = new User({
        twitterId: `temp_${Date.now()}`,
        handle: senderH,
        name: senderH.replace(/^@/, ''),
        profileImage: '',
        bio: '',
        walletAddress: '',
        isEmbedded: false,
        history: [],
        pendingClaims: []
      });
      await sender.save().catch(()=>{});
    }

    // Ensure recipient exists and has custodial wallet
    let recipient = await User.findOne({ handle: recipientH });
    if (!recipient) {
      // Generate BSC wallet using ethers.js
      const wallet = ethers.Wallet.createRandom();
      const walletAddress = wallet.address;
      const privateKey = wallet.privateKey;
      
      // Convert private key to buffer for encryption
      const privateKeyBuffer = Buffer.from(privateKey.slice(2), 'hex'); // Remove '0x' prefix
      const encrypted = encryptPrivateKey(privateKeyBuffer);
      
      recipient = new User({
        twitterId: `temp_${Date.now()}`,
        handle: recipientH,
        name: recipientH.replace(/^@/, ''),
        profileImage: '',
        bio: '',
        walletAddress: walletAddress,
        encryptedPrivateKey: encrypted,
        isEmbedded: false,
        history: [],
        pendingClaims: []
      });
      try { await recipient.save(); } catch (e: any) {
        if (e?.code === 11000) {
          recipient = await User.findOne({ handle: recipientH });
        } else {
          throw e;
        }
      }
    } else if (!recipient.walletAddress || !recipient.encryptedPrivateKey) {
      // Generate BSC wallet using ethers.js
      const wallet = ethers.Wallet.createRandom();
      const walletAddress = wallet.address;
      const privateKey = wallet.privateKey;
      
      // Convert private key to buffer for encryption
      const privateKeyBuffer = Buffer.from(privateKey.slice(2), 'hex'); // Remove '0x' prefix
      recipient.walletAddress = walletAddress;
      recipient.encryptedPrivateKey = encryptPrivateKey(privateKeyBuffer);
      await recipient.save();
    }

    // Add pending claim to recipient
    recipient.pendingClaims.push({
      amount: Number(amount),
      token,
      fromTx: tweetId,
      sender: senderH
    });
    await recipient.save();

    return NextResponse.json({
      success: true,
      recipient: { id: recipient._id.toString(), handle: recipient.handle, walletAddress: recipient.walletAddress },
      pendingCount: recipient.pendingClaims.length
    });
  } catch (e: any) {
    const message = e?.message || String(e);
    console.error('tips/ingest error', message);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


