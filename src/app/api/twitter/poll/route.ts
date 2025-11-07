import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import ProcessedTweet from '@/models/ProcessedTweet';
import QueuedReply from '@/models/QueuedReply';
import { searchMentions, postTweet, getPostTweetRateLimitResetTime } from '@/lib/twitter';
import { sendTwitterReplyToTelegram } from '@/lib/telegram';
import Web3 from 'web3';
import { decryptPrivateKey } from '@/lib/crypto';

const BOT_HANDLE = '@Quasartip';
const BSC_RPC_URL = process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
const web3 = new Web3(BSC_RPC_URL);

function parseTip(text: string): { amount: number; token: 'BNB'|'USDC'; recipientHandle: string } | null {
  // More flexible parsing - handles formats like:
  // "@Quasartip tip 0.01 bnb to @username"
  // "@Quasartip tip 0.01 to @username"
  // "@Quasartip tip 0.01BNB to @username"
  // "@Quasartip tip @username 0.01 bnb"
  
  // First try: standard format with token before recipient
  let re = /@quasartip\s+tip\s+(\d+(?:\.\d+)?)\s*(bnb|usdc)?\s+(?:to\s+)?@([a-z0-9_]+)/i;
  let m = text.match(re);
  if (m) {
    const amount = Number(m[1]);
    const token = (m[2]?.toUpperCase() as 'BNB'|'USDC') || 'BNB';
    const recipientHandle = `@${m[3]}`;
    return { amount, token, recipientHandle };
  }
  
  // Second try: format with recipient before amount
  re = /@quasartip\s+tip\s+@([a-z0-9_]+)\s+(\d+(?:\.\d+)?)\s*(bnb|usdc)?/i;
  m = text.match(re);
  if (m) {
    const amount = Number(m[2]);
    const token = (m[3]?.toUpperCase() as 'BNB'|'USDC') || 'BNB';
    const recipientHandle = `@${m[1]}`;
    return { amount, token, recipientHandle };
  }
  
  // Third try: amount without explicit token (default to BNB), recipient anywhere
  re = /@quasartip\s+tip\s+(\d+(?:\.\d+)?)\s+(?:to\s+)?@([a-z0-9_]+)/i;
  m = text.match(re);
  if (m) {
    const amount = Number(m[1]);
    const token = 'BNB';
    const recipientHandle = `@${m[2]}`;
    return { amount, token, recipientHandle };
  }
  
  return null;
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { sinceId } = await req.json().catch(() => ({ sinceId: undefined }));

      // Pull recent mentions of the bot
      // Handle rate limiting gracefully
      let tweets: any[] = [];
      try {
        tweets = await searchMentions(`${BOT_HANDLE} -is:retweet`, sinceId);
      } catch (searchError: any) {
        // If rate limited, return early without processing
        if (searchError?.code === 429 || searchError?.statusCode === 429) {
          const rateLimit = searchError?.rateLimit;
          const resetTime = rateLimit?.reset ? new Date(rateLimit.reset * 1000) : new Date(Date.now() + 900000);
          const waitMinutes = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
          
          console.warn('⚠️ Rate limited - skipping this poll cycle', {
            resetTime: resetTime.toISOString(),
            waitMinutes
          });
          
          return NextResponse.json({ 
            success: true, 
            processed: 0, 
            message: `Rate limited - will retry after ${waitMinutes} minutes`,
            rateLimited: true,
            resetTime: resetTime.toISOString()
          });
        }
        // Re-throw other errors
        throw searchError;
      }
      
      if (!tweets.length) {
        return NextResponse.json({ success: true, processed: 0, message: 'No new mentions found' });
      }

    // BSC connection is already initialized above

    // Check which tweets have already been processed (deduplication)
    const tweetIds = tweets.map(t => String(t.id)).filter(Boolean);
    const processedTweets = await ProcessedTweet.find({ tweetId: { $in: tweetIds } });
    const processedTweetIds = new Set(processedTweets.map(pt => pt.tweetId));
    
    // Filter out already processed tweets
    const unprocessedTweets = tweets.filter(t => {
      const tweetId = String(t.id);
      return tweetId && !processedTweetIds.has(tweetId);
    });
    
    if (unprocessedTweets.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'All tweets already processed' });
    }

    // Batch tips by sender-to-recipient pairs to combine multiple tips into single transactions
    type BatchedTip = {
      tweet: any;
      senderHandle: string;
      recipientHandle: string;
      amount: number;
      token: string;
      tweetId: string;
    };
    
    const batchedTips = new Map<string, BatchedTip[]>();
    
    // First pass: parse all tips and group by sender->recipient
    for (const t of unprocessedTweets) {
      const parsed = parseTip(t.text || '');
      if (!parsed) continue;

      // Try to get sender username from tweet metadata
      let senderHandle = `@unknown_${t.author_id}`;
      try {
        if ((t as any).author?.username) {
          senderHandle = `@${(t as any).author.username}`;
        } else if ((t as any).username) {
          senderHandle = `@${(t as any).username}`;
        }
      } catch {}

      const recipientHandle = parsed.recipientHandle;
      const batchKey = `${senderHandle}->${recipientHandle}`;
      
      if (!batchedTips.has(batchKey)) {
        batchedTips.set(batchKey, []);
      }
      batchedTips.get(batchKey)!.push({
        tweet: t,
        senderHandle,
        recipientHandle,
        amount: parsed.amount,
        token: parsed.token,
        tweetId: t.id
      });
    }

    let processed = 0;
    
    // Process batched tips (multiple tips from same sender to same recipient = one transaction)
    for (const [batchKey, tips] of batchedTips.entries()) {
      if (tips.length === 0) continue;
      
      // Use first tip for lookup (sender/recipient are the same across batch)
      const firstTip = tips[0];
      const t = firstTip.tweet;
      
      // Validate tweet ID exists
      if (!t?.id) {
        console.error(`Tweet ID missing for batched tips. Batch key: ${batchKey}, Tips count: ${tips.length}`);
        processed += tips.length;
        continue;
      }
      
      const senderHandle = firstTip.senderHandle;
      const recipientHandle = firstTip.recipientHandle;
      const recipientUsername = recipientHandle.replace(/^@/, '');
      const senderUsername = senderHandle.replace(/^@/, '');
      
      // Calculate total amount for batched tips
      const totalAmount = tips.reduce((sum, tip) => sum + tip.amount, 0);
      const token = tips[0].token; // All tips in batch should have same token
      
      console.log(`Processing ${tips.length} tip(s) batched: sender=${senderHandle}, recipient=${recipientHandle}, total amount=${totalAmount} ${token}`);

      // Check if recipient exists (already signed up) or is new (needs wallet created)
      // Normalize recipient handle to ensure consistent lookup
      const normalizedRecipientHandle = recipientHandle.startsWith('@') ? recipientHandle : `@${recipientHandle}`;
      let recipient = await User.findOne({ handle: normalizedRecipientHandle });
      
      // If not found, try without @ prefix
      if (!recipient) {
        recipient = await User.findOne({ handle: normalizedRecipientHandle.replace(/^@/, '') });
      }
      
      // Check if recipient has an account (isEmbedded = true means they've signed up)
      const recipientHasAccount = !!recipient && recipient.isEmbedded === true;
      
      console.log(`Recipient check: handle=${normalizedRecipientHandle}, found=${!!recipient}, hasAccount=${recipientHasAccount}, isEmbedded=${recipient?.isEmbedded}, wallet=${recipient?.walletAddress || 'N/A'}`);
      
      // Check if sender is registered (has custodial wallet)
      // Look up sender by handle (normalized with @)
      const normalizedSenderHandle = senderHandle.startsWith('@') ? senderHandle : `@${senderHandle}`;
      let sender = await User.findOne({ handle: normalizedSenderHandle });
      
      // If not found by handle, try without @ prefix
      if (!sender) {
        const handleWithoutAt = normalizedSenderHandle.replace(/^@/, '');
        sender = await User.findOne({ handle: { $in: [handleWithoutAt, `@${handleWithoutAt}`] } });
      }
      
      // Also try to find by Twitter ID if we have the author_id
      if (!sender && t.author_id) {
        sender = await User.findOne({ twitterId: t.author_id });
      }
      
      const senderIsRegistered = !!sender && !!sender.encryptedPrivateKey && !!sender.walletAddress;
      
      console.log(`Sender check: handle=${normalizedSenderHandle}, author_id=${t.author_id}, found=${!!sender}, registered=${senderIsRegistered}, wallet=${sender?.walletAddress || 'N/A'}`);

      // Only create wallet for non-existing users (don't create new wallet for existing users)
      if (!recipient || !recipient.walletAddress || !recipient.encryptedPrivateKey) {
        // Non-existing user - create wallet for them so we can send BNB
        const base = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        try {
          const createRes = await fetch(`${base}/api/wallet/create-custodial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              handle: recipientHandle,
              twitterId: `temp_${Date.now()}` // Temporary ID until they sign up
            })
          });
          
          // Refresh recipient after creation
          if (createRes.ok) {
            recipient = await User.findOne({ handle: normalizedRecipientHandle });
            if (!recipient) {
              recipient = await User.findOne({ handle: normalizedRecipientHandle.replace(/^@/, '') });
            }
            console.log(`Recipient wallet created/retrieved: handle=${normalizedRecipientHandle}, wallet=${recipient?.walletAddress || 'N/A'}`);
          }
        } catch (e) {
          console.error('Failed to create recipient wallet:', e);
        }
      }

      // User flow logic:
      // - If recipient HAS an account (isEmbedded = true): send immediately, add to history, reply with BscScan link
      // - If recipient DOESN'T have an account (isEmbedded = false or no account): record as pending claim, they can claim when they sign up
      // - Only send if sender is registered and recipient has wallet
      
      // IMPORTANT: Mark tweets as processed BEFORE attempting transaction to prevent duplicate processing
      // This prevents the same tweet from being processed multiple times if polling happens before transaction completes
      for (const tip of tips) {
        await ProcessedTweet.findOneAndUpdate(
          { tweetId: tip.tweetId },
          { tweetId: tip.tweetId, processedAt: new Date() },
          { upsert: true, new: true }
        );
      }
      
      if (senderIsRegistered && recipient && recipient.walletAddress && token === 'BNB') {
        try {
          console.log(`🔄 Starting transaction: sender=${sender.walletAddress}, recipient=${recipient.walletAddress}, amount=${totalAmount} ${token}`);
          
          // Decrypt sender's private key
          console.log('🔐 Decrypting sender private key...');
          const privateKeyBytes = decryptPrivateKey(sender.encryptedPrivateKey!);
          const privateKeyHex = '0x' + Buffer.from(privateKeyBytes).toString('hex');
          console.log('✅ Private key decrypted');
          
          // Create account from private key
          console.log('🔑 Creating account from private key...');
          const account = web3.eth.accounts.privateKeyToAccount(privateKeyHex);
          const fromAddress = account.address;
          console.log(`✅ Account created: ${fromAddress}`);
          
          // Verify sender address matches
          if (fromAddress.toLowerCase() !== sender.walletAddress.toLowerCase()) {
            throw new Error(`Sender wallet address mismatch: ${fromAddress} !== ${sender.walletAddress}`);
          }
          console.log('✅ Sender address verified');
          
          // Check sender balance before attempting transfer (for total batched amount)
          console.log('💰 Checking sender balance...');
          const senderBalance = await web3.eth.getBalance(fromAddress);
          const amountWei = web3.utils.toWei(totalAmount.toString(), 'ether');
          const balanceBN = senderBalance; // getBalance returns bigint in Web3.js v4
          const amountBN = BigInt(amountWei.toString());
          console.log(`✅ Balance checked: ${web3.utils.fromWei(senderBalance.toString(), 'ether')} BNB`);
          
          // Get gas price and estimate gas
          console.log('⛽ Estimating gas...');
          const gasPrice = await web3.eth.getGasPrice();
          const gasEstimate = await web3.eth.estimateGas({
            from: fromAddress,
            to: recipient.walletAddress,
            value: amountWei
          });
          console.log(`✅ Gas estimated: ${gasEstimate.toString()}, price: ${gasPrice.toString()}`);
          
          // Calculate total required (amount + gas)
          const gasCost = gasPrice * gasEstimate;
          const totalRequired = amountBN + gasCost;
          
          if (balanceBN < totalRequired) {
            const availableBNB = parseFloat(web3.utils.fromWei(senderBalance.toString(), 'ether'));
            throw new Error(`Insufficient balance. Available: ${availableBNB.toFixed(4)} BNB, Requested: ${totalAmount} BNB (batched ${tips.length} tip(s))`);
          }
          console.log('✅ Balance sufficient for transaction');
          
          // Create single transaction for all batched tips (one transfer with total amount)
          const tx = {
            from: fromAddress,
            to: recipient.walletAddress,
            value: amountWei,
            gas: gasEstimate.toString(),
            gasPrice: gasPrice.toString()
          };
          
          console.log(`Transferring ${totalAmount} BNB (${tips.length} tip(s) batched) from ${sender.walletAddress} to ${recipient.walletAddress} (recipient handle: ${normalizedRecipientHandle})`);

          // Sign and send transaction
          let signedTx;
          let receipt;
          let sig: string;
          
          try {
            signedTx = await web3.eth.accounts.signTransaction(tx, privateKeyHex);
            console.log('✅ Transaction signed successfully');
          } catch (signError: any) {
            console.error('❌ Failed to sign transaction:', signError);
            throw new Error(`Failed to sign transaction: ${signError?.message || String(signError)}`);
          }
          
          try {
            receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            sig = receipt.transactionHash.toString();
            console.log(`✅ Transaction sent successfully: ${sig}`);
          } catch (sendError: any) {
            console.error('❌ Failed to send transaction:', sendError);
            throw new Error(`Failed to send transaction: ${sendError?.message || String(sendError)}`);
          }

          // Wait for confirmation (polling approach for Web3.js v4)
          console.log(`⏳ Waiting for transaction confirmation: ${sig}`);
          let confirmedReceipt = null;
          const startTime = Date.now();
          while (Date.now() - startTime < 60000) {
            confirmedReceipt = await web3.eth.getTransactionReceipt(sig);
            if (confirmedReceipt) {
              if (!confirmedReceipt.status) {
                throw new Error('Transaction was reverted');
            }
              console.log('✅ Transaction confirmed');
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          if (!confirmedReceipt) {
            throw new Error('Transaction confirmation timeout');
          }

          // Record in sender's history (one entry for the batched transaction)
          sender.history.push({
            type: 'transfer',
            amount: totalAmount,
            token: token,
            counterparty: recipientHandle,
            txHash: sig,
            date: new Date()
          });

          // If recipient HAS an account: add to their history and reply with BscScan link
          // If recipient DOESN'T have an account: record as pending claim (they can claim when they sign up)
          if (recipientHasAccount) {
            // Recipient has account - add to history immediately
          recipient.history.push({
            type: 'tip',
            amount: totalAmount,
            token: token,
            counterparty: senderHandle,
            txHash: sig,
            date: new Date()
          });

            // Remove all pending claims for batched tips (they're now in history)
          const tweetIds = tips.map(tip => tip.tweetId);
          recipient.pendingClaims = recipient.pendingClaims.filter(
            (p: any) => !(tweetIds.includes(p.fromTx) && p.sender === senderHandle)
          );

            // Post success message with BscScan link - recipient has account, so they receive immediately
            const tipText = tips.length === 1 
              ? `A ${totalAmount} ${token} tip has been sent to your wallet!`
              : `${tips.length} tips totaling ${totalAmount} ${token} have been sent to your wallet!`;
            const replyText = `@${recipientUsername} pay from @${senderUsername} ${tipText} Tx: https://bscscan.com/tx/${sig}`;
            console.log(`Attempting to post reply to tweet ${t.id}:`, replyText);
            try {
              const replyId = await postTweet(replyText, t.id ? String(t.id) : undefined);
              if (!replyId) {
                // Twitter failed - send to Telegram for manual posting
                console.log(`📱 Sending reply to Telegram for manual posting (tweet ${t.id})`);
                await sendTwitterReplyToTelegram(replyText, String(t.id), sig);
                
                // Queue the reply for retry
                const resetTime = getPostTweetRateLimitResetTime();
                const nextRetryAt = resetTime && resetTime > new Date() 
                  ? resetTime 
                  : new Date(Date.now() + 15 * 60 * 1000); // Default to 15 minutes
                
                await QueuedReply.findOneAndUpdate(
                  { tweetId: String(t.id) },
                  {
                    tweetId: String(t.id),
                    replyText,
                    replyToTweetId: String(t.id),
                    txHash: sig,
                    nextRetryAt,
                    status: 'pending',
                    $inc: { attempts: 1 },
                    lastAttemptAt: new Date()
                  },
                  { upsert: true, new: true }
                );
                
                console.log(`📝 Queued reply for tweet ${t.id} to retry at ${nextRetryAt.toISOString()}`);
                console.error(`❌ Failed to post reply to tweet ${t.id}. Tweet ID type: ${typeof t.id}, Value: ${t.id}. Sent to Telegram for manual posting.`);
              } else {
                console.log(`✅ Successfully posted reply ${replyId} to tweet ${t.id}`);
                // Remove from queue if it was queued
                await QueuedReply.findOneAndDelete({ tweetId: String(t.id) });
              }
            } catch (replyError: any) {
              console.error(`❌ Exception while posting reply to tweet ${t.id}:`, replyError);
              
              // Twitter failed - send to Telegram for manual posting
              console.log(`📱 Sending reply to Telegram for manual posting (tweet ${t.id})`);
              await sendTwitterReplyToTelegram(replyText, String(t.id), sig);
              
              // Queue the reply for retry
              const resetTime = getPostTweetRateLimitResetTime();
              const nextRetryAt = resetTime && resetTime > new Date() 
                ? resetTime 
                : new Date(Date.now() + 15 * 60 * 1000);
              
              await QueuedReply.findOneAndUpdate(
                { tweetId: String(t.id) },
                {
                  tweetId: String(t.id),
                  replyText,
                  replyToTweetId: String(t.id),
                  txHash: sig,
                  nextRetryAt,
                  status: 'pending',
                  error: replyError?.message || String(replyError),
                  $inc: { attempts: 1 },
                  lastAttemptAt: new Date()
                },
                { upsert: true, new: true }
              );
            }
          } else {
            // Recipient doesn't have account - record as pending claim (they can claim when they sign up)
            const tweetIds = tips.map(tip => tip.tweetId);
            for (const tip of tips) {
              const existingClaim = recipient.pendingClaims.find(
                (p: any) => p.fromTx === tip.tweetId && p.sender === senderHandle
              );
              if (!existingClaim) {
                recipient.pendingClaims.push({
                  amount: tip.amount,
                  token: tip.token,
                  fromTx: tip.tweetId,
                  sender: senderHandle
                });
              }
            }

            // Post message telling them to claim when they sign up
          const tipText = tips.length === 1 
            ? `A ${totalAmount} ${token} tip has been sent to your wallet!`
            : `${tips.length} tips totaling ${totalAmount} ${token} have been sent to your wallet!`;
            const replyText = `@${recipientUsername} pay from @${senderUsername} ${tipText} Claim it when you sign up on quasar.tips. Tx: https://bscscan.com/tx/${sig}`;
            console.log(`Attempting to post reply to tweet ${t.id}:`, replyText);
            try {
          const replyId = await postTweet(replyText, t.id ? String(t.id) : undefined);
          if (!replyId) {
                // Queue the reply for retry
                const resetTime = getPostTweetRateLimitResetTime();
                const nextRetryAt = resetTime && resetTime > new Date() 
                  ? resetTime 
                  : new Date(Date.now() + 15 * 60 * 1000); // Default to 15 minutes
                
                await QueuedReply.findOneAndUpdate(
                  { tweetId: String(t.id) },
                  {
                    tweetId: String(t.id),
                    replyText,
                    replyToTweetId: String(t.id),
                    txHash: sig,
                    nextRetryAt,
                    status: 'pending',
                    $inc: { attempts: 1 },
                    lastAttemptAt: new Date()
                  },
                  { upsert: true, new: true }
                );
                
                console.log(`📝 Queued reply for tweet ${t.id} to retry at ${nextRetryAt.toISOString()}`);
                console.error(`❌ Failed to post reply to tweet ${t.id}. Tweet ID type: ${typeof t.id}, Value: ${t.id}. Queued for retry.`);
              } else {
                console.log(`✅ Successfully posted reply ${replyId} to tweet ${t.id}`);
                // Remove from queue if it was queued
                await QueuedReply.findOneAndDelete({ tweetId: String(t.id) });
              }
            } catch (replyError: any) {
              console.error(`❌ Exception while posting reply to tweet ${t.id}:`, replyError);
              // Queue the reply for retry
              const resetTime = getPostTweetRateLimitResetTime();
              const nextRetryAt = resetTime && resetTime > new Date() 
                ? resetTime 
                : new Date(Date.now() + 15 * 60 * 1000);
              
              await QueuedReply.findOneAndUpdate(
                { tweetId: String(t.id) },
                {
                  tweetId: String(t.id),
                  replyText,
                  replyToTweetId: String(t.id),
                  txHash: sig,
                  nextRetryAt,
                  status: 'pending',
                  error: replyError?.message || String(replyError),
                  $inc: { attempts: 1 },
                  lastAttemptAt: new Date()
                },
                { upsert: true, new: true }
              );
            }
          }

          await sender.save();
          await recipient.save();
          
        } catch (e: any) {
          console.error('Failed to send batched tip on-chain:', e);
          // Transfer failed - record all tips as pending claims, no BscScan link yet
          if (recipient) {
            for (const tip of tips) {
              const existingClaim = recipient.pendingClaims.find(
                (p: any) => p.fromTx === tip.tweetId && p.sender === senderHandle
              );
              if (!existingClaim) {
                recipient.pendingClaims.push({
                  amount: tip.amount,
                  token: tip.token,
                  fromTx: tip.tweetId,
                  sender: senderHandle
                });
              }
            }
            await recipient.save();
          }
          const message = `@${recipientUsername} pay from @${senderUsername} ${tips.length === 1 ? `A ${totalAmount} ${token} tip` : `${tips.length} tips totaling ${totalAmount} ${token}`} ${tips.length === 1 ? 'has' : 'have'} been recorded for you! Claim ${tips.length === 1 ? 'it' : 'them'} to receive the BscScan link:`;
          try {
          const replyId = await postTweet(message, t.id ? String(t.id) : undefined);
          if (!replyId) {
              console.error(`❌ Failed to post reply to tweet ${t.id} (transfer failed). Tweet ID type: ${typeof t.id}, Value: ${t.id}`);
            }
          } catch (replyError: any) {
            console.error(`❌ Exception while posting reply to tweet ${t.id} (transfer failed):`, replyError);
          }
        }
      } else {
        // Sender not registered - can't transfer yet (no sender wallet)
        // Sender needs to sign up on quasar.tips first to create a custodial wallet
        // Generate recipient wallet and record pending claims for all tips
        // When sender signs up and funds their wallet, they can claim and send the tips
        console.log(`Sender ${normalizedSenderHandle} not registered - recording ${tips.length} pending claim(s)`);
        if (recipient) {
          for (const tip of tips) {
            const existingClaim = recipient.pendingClaims.find(
              (p: any) => p.fromTx === tip.tweetId && p.sender === normalizedSenderHandle
            );
            if (!existingClaim) {
              recipient.pendingClaims.push({
                amount: tip.amount,
                token: tip.token,
                fromTx: tip.tweetId,
                sender: normalizedSenderHandle
              });
            }
          }
          await recipient.save();
        }
        // Format: "@recipient pay from @sender A X BNB tip has been recorded for you! Claim it to receive the BscScan link:"
        // Note: Sender must sign up on quasar.tips first to fund their wallet before the tip can be sent
        const message = `@${recipientUsername} pay from @${senderUsername} ${tips.length === 1 ? `A ${totalAmount} ${token} tip` : `${tips.length} tips totaling ${totalAmount} ${token}`} ${tips.length === 1 ? 'has' : 'have'} been recorded for you! The sender needs to sign up on quasar.tips first. Claim ${tips.length === 1 ? 'it' : 'them'} to receive the BscScan link:`;
        try {
        const replyId = await postTweet(message, t.id ? String(t.id) : undefined);
        if (!replyId) {
            console.error(`❌ Failed to post reply to tweet ${t.id} (sender not registered). Tweet ID type: ${typeof t.id}, Value: ${t.id}`);
          }
        } catch (replyError: any) {
          console.error(`❌ Exception while posting reply to tweet ${t.id} (sender not registered):`, replyError);
        }
      }

      processed += tips.length; // Count all tips in the batch
    }

    return NextResponse.json({ success: true, processed });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('twitter/poll error', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


