import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Web3 from 'web3';
import { ethers } from 'ethers';
import { decryptPrivateKey } from '@/lib/crypto';

// POST /api/wallet/withdraw
// Body: { handle: string, toAddress: string, amount: number }
// Withdraws BNB from custodial tip wallet to another address
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { handle, toAddress, amount } = await req.json();
    
    if (!handle || !toAddress || !amount) {
      return NextResponse.json({ error: 'Missing required fields: handle, toAddress, amount' }, { status: 400 });
    }

    const norm = (h: string) => (h.startsWith('@') ? h : `@${h}`);
    const userHandle = norm(handle);

    // Find user with custodial wallet
    let user;
    try {
      user = await User.findOne({ handle: userHandle });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (!user.encryptedPrivateKey) {
        return NextResponse.json({ error: 'User has no custodial wallet private key' }, { status: 404 });
      }
      if (!user.walletAddress) {
        return NextResponse.json({ error: 'User has no wallet address' }, { status: 404 });
      }
    } catch (e: any) {
      console.error('Error finding user:', e?.message);
      return NextResponse.json({ error: 'Database error while finding user', details: e?.message }, { status: 500 });
    }

    // Validate recipient address (BSC address format)
    if (!Web3.utils.isAddress(toAddress)) {
      return NextResponse.json({ error: 'Invalid recipient address format' }, { status: 400 });
    }

    // Validate amount
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Decrypt private key
    let privateKeyBytes: Uint8Array;
    let privateKeyHex: string;
    try {
      if (!process.env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
      }
      privateKeyBytes = decryptPrivateKey(user.encryptedPrivateKey);
      // Convert private key bytes to hex string (BSC/Ethereum format)
      privateKeyHex = '0x' + Buffer.from(privateKeyBytes).toString('hex');
      
      // Validate private key
      if (!privateKeyHex || privateKeyHex.length !== 66) {
        throw new Error(`Invalid decrypted key length: ${privateKeyHex?.length}, expected 66 (32 bytes + 0x prefix)`);
      }
    } catch (e: any) {
      console.error('Error decrypting private key:', e?.message);
      return NextResponse.json({ 
        error: 'Failed to decrypt private key', 
        details: e?.message 
      }, { status: 500 });
    }

    // Initialize Web3
    const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
    const web3 = new Web3(rpcUrl);

    // Get wallet address from private key
    const account = web3.eth.accounts.privateKeyToAccount(privateKeyHex);
    const walletAddress = account.address;

    // Verify wallet address matches
    if (walletAddress.toLowerCase() !== user.walletAddress.toLowerCase()) {
      return NextResponse.json({ 
        error: 'Wallet address mismatch', 
        details: 'Decrypted private key does not match stored wallet address' 
      }, { status: 500 });
    }

    // Get balance
    let balance: bigint;
    try {
      balance = await web3.eth.getBalance(walletAddress);
    } catch (e: any) {
      console.error('Error getting balance:', e?.message);
      return NextResponse.json({ 
        error: 'Failed to get wallet balance', 
        details: e?.message 
      }, { status: 500 });
    }
    
    // Convert amount to Wei (1 BNB = 10^18 Wei)
    const amountWei = web3.utils.toWei(amountNum.toString(), 'ether');
    const balanceBN = balance;
    const amountBN = BigInt(amountWei.toString());
    
    // Get gas price and estimate gas
    let gasPrice: bigint;
    let gasEstimate: bigint;
    try {
      gasPrice = await web3.eth.getGasPrice();
      gasEstimate = await web3.eth.estimateGas({
        from: walletAddress,
        to: toAddress,
        value: amountWei
      });
    } catch (e: any) {
      console.error('Error estimating gas:', e?.message);
      return NextResponse.json({ 
        error: 'Failed to estimate gas', 
        details: e?.message 
      }, { status: 500 });
    }
    
    // Calculate total required (amount + gas)
    const gasCost = gasPrice * gasEstimate;
    const totalRequired = amountBN + gasCost;
    
    if (balanceBN < totalRequired) {
      const availableBNB = parseFloat(web3.utils.fromWei(balance.toString(), 'ether'));
      const requestedBNB = amountNum;
      const gasCostBNB = parseFloat(web3.utils.fromWei(gasCost.toString(), 'ether'));
      return NextResponse.json({ 
        error: `Insufficient balance. Available: ${availableBNB.toFixed(4)} BNB, Requested: ${requestedBNB} BNB, Estimated gas: ${gasCostBNB.toFixed(6)} BNB` 
      }, { status: 400 });
    }

    // Create and send transaction
    let txHash: string;
    try {
      // Create transaction
      const tx = {
        from: walletAddress,
        to: toAddress,
        value: amountWei,
        gas: gasEstimate.toString(),
        gasPrice: gasPrice.toString()
      };

      // Sign transaction
      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKeyHex);
      
      if (!signedTx.rawTransaction) {
        throw new Error('Failed to sign transaction');
      }

      // Send transaction
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      txHash = receipt.transactionHash.toString();
      
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      console.error('Error creating/sending transaction:', errorMsg);
      return NextResponse.json({ 
        error: 'Failed to create or send transaction', 
        details: errorMsg
      }, { status: 500 });
    }

    // Wait for confirmation (polling approach for Web3.js v4)
    try {
      let receipt = null;
      const startTime = Date.now();
      while (Date.now() - startTime < 60000) {
        receipt = await web3.eth.getTransactionReceipt(txHash);
        if (receipt) {
          if (!receipt.status) {
            return NextResponse.json({ 
              error: 'Transaction failed', 
              details: 'Transaction was reverted' 
            }, { status: 500 });
          }
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      if (!receipt) {
        // Transaction might still be pending, but we have the txHash
        // Return success with txHash so user can check on BscScan
        console.warn('Transaction confirmation timeout, but txHash is available');
      }
    } catch (e: any) {
      console.error('Error confirming transaction:', e?.message);
      // Transaction might still be pending, but we have the txHash
      // Return success with txHash so user can check on BscScan
    }

    // Record in history
    try {
      user.history.push({
        type: 'transfer',
        amount: amountNum,
        token: 'BNB',
        counterparty: toAddress,
        txHash: txHash,
        date: new Date()
      });
      await user.save();
    } catch (e: any) {
      console.error('Error saving transaction history:', e?.message);
      // Don't fail the request if history save fails, but log it
    }

    return NextResponse.json({
      success: true,
      txHash: txHash,
      amount: amountNum,
      from: user.walletAddress,
      to: toAddress,
      bscscanUrl: `https://bscscan.com/tx/${txHash}`
    });

  } catch (e: any) {
    const message = e?.message || String(e);
    const stack = e?.stack || '';
    console.error('wallet/withdraw error', message, stack);
    
    // Always return error details for debugging (even in production)
    return NextResponse.json({ 
      error: 'Withdrawal failed', 
      details: message,
      stack: process.env.NODE_ENV !== 'production' ? stack : undefined
    }, { status: 500 });
  }
}

