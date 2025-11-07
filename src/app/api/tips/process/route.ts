import { NextRequest, NextResponse } from 'next/server';
import Web3 from 'web3';
import { ethers } from 'ethers';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { shouldUseX402, x402Server } from '@/lib/x402';
import { postTweet } from '@/lib/twitter';
import { decryptPrivateKey } from '@/lib/crypto';

const BSC_RPC_URL = process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
const web3 = new Web3(BSC_RPC_URL);

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { 
      senderHandle, 
      recipientHandle, 
      amount, 
      token, 
      tweetText,
      tweetId 
    } = await request.json();
    
    if (!senderHandle || !recipientHandle || !amount || !token) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Find sender
    const sender = await User.findOne({ handle: senderHandle });
    if (!sender) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      );
    }

    // Find or create recipient
    let recipient = await User.findOne({ handle: recipientHandle });
    if (!recipient) {
      // Create custodial wallet for unsigned user
      const createCustodialResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/wallet/create-custodial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitterId: `temp_${Date.now()}`, // Temporary ID until user signs up
          handle: recipientHandle
        })
      });
      
      if (!createCustodialResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to create recipient wallet' },
          { status: 500 }
        );
      }
      
      const { walletAddress } = await createCustodialResponse.json();
      recipient = await User.findOne({ walletAddress });
    }

    // Check if we should use x402 for micropayments
    if (shouldUseX402(amount, token, tweetText)) {
      return x402Server.sendPaymentRequired(
        NextResponse,
        {
          amount: amount,
          currency: token === 'BNB' ? 'USDC' : token, // Convert BNB tips to USDC for x402
          facilitator: 'coinbase',
          description: `Tip from ${senderHandle} to ${recipientHandle}`
        }
      );
    }

    // Process regular BSC transfer
    const txHash = await processBSCTransfer(sender, recipient, amount, token);

    // Add to both users' transaction history
    const transaction = {
      type: 'tip' as const,
      amount: amount,
      token: token as 'BNB' | 'USDC',
      counterparty: recipientHandle,
      txHash: txHash,
      date: new Date()
    };

    sender.history.push(transaction);
    await sender.save();

    // For unsigned recipients, add to pending claims
    if (!recipient.isEmbedded) {
      recipient.pendingClaims.push({
        amount: amount,
        token: token,
        fromTx: txHash,
        sender: senderHandle
      });
    } else {
      // For signed recipients, add to history
      recipient.history.push(transaction);
    }
    await recipient.save();

    // Post confirmation tweet
    const confirmationText = `✅ Tip sent! ${amount} ${token} to ${recipientHandle}\nTx: ${txHash}`;
    await postTweet(confirmationText);

    return NextResponse.json({
      success: true,
      txHash: txHash,
      message: 'Tip processed successfully'
    });

  } catch (error) {
    console.error('Process tip error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processBSCTransfer(sender: any, recipient: any, amount: number, token: string): Promise<string> {
  try {
    // Decrypt sender's private key
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    
    const privateKeyBytes = decryptPrivateKey(sender.encryptedPrivateKey);
    const privateKeyHex = '0x' + Buffer.from(privateKeyBytes).toString('hex');
    
    // Create account from private key
    const account = web3.eth.accounts.privateKeyToAccount(privateKeyHex);
    const fromAddress = account.address;
    
    // Verify sender address matches
    if (fromAddress.toLowerCase() !== sender.walletAddress.toLowerCase()) {
      throw new Error('Sender wallet address mismatch');
    }
    
    if (token === 'BNB') {
      // Send native BNB
      const amountWei = web3.utils.toWei(amount.toString(), 'ether');
      const gasPrice = await web3.eth.getGasPrice();
      const gasEstimate = await web3.eth.estimateGas({
        from: fromAddress,
        to: recipient.walletAddress,
        value: amountWei
      });
      
      const tx = {
        from: fromAddress,
        to: recipient.walletAddress,
        value: amountWei,
        gas: gasEstimate,
        gasPrice: gasPrice
      };
      
      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKeyHex);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      return receipt.transactionHash;
    } else {
      // Send BEP-20 token (USDC, USDT, etc.)
      const tokenAddresses: { [key: string]: string } = {
        'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        'USDT': '0x55d398326f99059fF775485246999027B3197955'
      };
      
      const tokenAddress = tokenAddresses[token];
      if (!tokenAddress) {
        throw new Error(`Unsupported token: ${token}`);
      }
      
      // ERC-20 ABI for transfer
      const tokenAbi = [
        {
          constant: false,
          inputs: [
            { name: '_to', type: 'address' },
            { name: '_value', type: 'uint256' }
          ],
          name: 'transfer',
          outputs: [{ name: '', type: 'bool' }],
          type: 'function'
        },
        {
          constant: true,
          inputs: [],
          name: 'decimals',
          outputs: [{ name: '', type: 'uint8' }],
          type: 'function'
        }
      ];
      
      const tokenContract = new web3.eth.Contract(tokenAbi, tokenAddress);
      const decimals = await tokenContract.methods.decimals().call();
      const amountWei = web3.utils.toBN(amount).mul(web3.utils.toBN(10).pow(web3.utils.toBN(decimals)));
      
      const data = tokenContract.methods.transfer(recipient.walletAddress, amountWei.toString()).encodeABI();
      
      const gasPrice = await web3.eth.getGasPrice();
      const gasEstimate = await web3.eth.estimateGas({
        from: fromAddress,
        to: tokenAddress,
        data: data
      });
      
      const tx = {
        from: fromAddress,
        to: tokenAddress,
        data: data,
        gas: gasEstimate,
        gasPrice: gasPrice
      };
      
      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKeyHex);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      return receipt.transactionHash;
    }
  } catch (error) {
    console.error('Error processing BSC transfer:', error);
    throw error;
  }
}


