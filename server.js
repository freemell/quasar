const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { TwitterApi } = require('twitter-api-v2');
const Web3 = require('web3');
const { ethers } = require('ethers');
const sodium = require('libsodium-wrappers');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bnbtip';
mongoose.connect(MONGODB_URI);

// BSC connection using Web3.js
const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
const web3 = new Web3(BSC_RPC_URL);

// Also use ethers.js for better compatibility
const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);

// Twitter API client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Initialize libsodium
sodium.ready.then(() => {
  console.log('Libsodium initialized');
});

// Database schemas
const UserSchema = new mongoose.Schema({
  twitterHandle: { type: String, required: true, unique: true },
  twitterId: { type: String, required: true, unique: true },
  walletAddress: { type: String, required: true },
  encryptedPrivateKey: { type: String, required: true },
  nonce: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
  fromUser: { type: String, required: true },
  toUser: { type: String, required: true },
  amount: { type: Number, required: true },
  token: { type: String, required: true },
  txHash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const AutoPayRuleSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  condition: { type: String, required: true },
  amount: { type: Number, required: true },
  token: { type: String, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const AutoPayRule = mongoose.model('AutoPayRule', AutoPayRuleSchema);

// Encryption utilities
function encryptPrivateKey(privateKey, password) {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES),
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  const encrypted = sodium.crypto_secretbox_easy(privateKey, nonce, key);
  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64')
  };
}

function decryptPrivateKey(encryptedData, nonce, password) {
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES),
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  const decrypted = sodium.crypto_secretbox_open_easy(
    Buffer.from(encryptedData, 'base64'),
    Buffer.from(nonce, 'base64'),
    key
  );
  return Buffer.from(decrypted);
}

// Create custodial wallet for user (BSC/Ethereum compatible)
async function createCustodialWallet(twitterHandle) {
  // Generate a new BSC wallet using ethers.js
  const wallet = ethers.Wallet.createRandom();
  const walletAddress = wallet.address;
  const privateKey = wallet.privateKey;
  
  // Encrypt private key
  const password = process.env.ENCRYPTION_KEY || 'default-password';
  // Convert private key to buffer for encryption
  const privateKeyBuffer = Buffer.from(privateKey.slice(2), 'hex'); // Remove '0x' prefix
  const { encrypted, nonce } = encryptPrivateKey(privateKeyBuffer, password);
  
  // Store in database
  const user = new User({
    twitterHandle,
    twitterId: '', // Will be filled when we get the Twitter ID
    walletAddress,
    encryptedPrivateKey: encrypted,
    nonce
  });
  
  await user.save();
  return { walletAddress, user };
}

// Get user by Twitter handle
async function getUserByHandle(twitterHandle) {
  return await User.findOne({ twitterHandle });
}

// Get user by Twitter ID
async function getUserById(twitterId) {
  return await User.findOne({ twitterId });
}

// Send BNB transaction using Web3.js for BSC
async function sendBNB(fromPrivateKey, toAddress, amount) {
  try {
    // Convert private key buffer to hex string if needed
    let privateKeyHex;
    if (Buffer.isBuffer(fromPrivateKey)) {
      privateKeyHex = '0x' + fromPrivateKey.toString('hex');
    } else if (typeof fromPrivateKey === 'string') {
      privateKeyHex = fromPrivateKey.startsWith('0x') ? fromPrivateKey : '0x' + fromPrivateKey;
    } else {
      throw new Error('Invalid private key format');
    }

    // Create account from private key
    const account = web3.eth.accounts.privateKeyToAccount(privateKeyHex);
    const fromAddress = account.address;

    // Convert amount from BNB to Wei (1 BNB = 10^18 Wei)
    const amountWei = web3.utils.toWei(amount.toString(), 'ether');

    // Get gas price
    const gasPrice = await web3.eth.getGasPrice();
    
    // Estimate gas
    const gasEstimate = await web3.eth.estimateGas({
      from: fromAddress,
      to: toAddress,
      value: amountWei
    });

    // Create transaction
    const tx = {
      from: fromAddress,
      to: toAddress,
      value: amountWei,
      gas: gasEstimate,
      gasPrice: gasPrice
    };

    // Sign transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKeyHex);

    // Send transaction
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    return receipt.transactionHash;
  } catch (error) {
    console.error('Error sending BNB transaction:', error);
    throw error;
  }
}

// Send BEP-20 token (USDC, USDT, etc.) transaction
async function sendToken(fromPrivateKey, toAddress, amount, tokenContractAddress) {
  try {
    // Convert private key
    let privateKeyHex;
    if (Buffer.isBuffer(fromPrivateKey)) {
      privateKeyHex = '0x' + fromPrivateKey.toString('hex');
    } else if (typeof fromPrivateKey === 'string') {
      privateKeyHex = fromPrivateKey.startsWith('0x') ? fromPrivateKey : '0x' + fromPrivateKey;
    } else {
      throw new Error('Invalid private key format');
    }

    const account = web3.eth.accounts.privateKeyToAccount(privateKeyHex);
    const fromAddress = account.address;

    // Standard ERC-20 ABI for transfer function
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
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
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

    const tokenContract = new web3.eth.Contract(tokenAbi, tokenContractAddress);
    
    // Get token decimals
    const decimals = await tokenContract.methods.decimals().call();
    const amountWei = web3.utils.toBN(amount).mul(web3.utils.toBN(10).pow(web3.utils.toBN(decimals)));

    // Encode transfer function call
    const data = tokenContract.methods.transfer(toAddress, amountWei.toString()).encodeABI();

    // Get gas price and estimate gas
    const gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await web3.eth.estimateGas({
      from: fromAddress,
      to: tokenContractAddress,
      data: data
    });

    // Create transaction
    const tx = {
      from: fromAddress,
      to: tokenContractAddress,
      data: data,
      gas: gasEstimate,
      gasPrice: gasPrice
    };

    // Sign and send transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKeyHex);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    return receipt.transactionHash;
  } catch (error) {
    console.error('Error sending token transaction:', error);
    throw error;
  }
}

// Parse tip command from tweet text
function parseTipCommand(text) {
  const tipRegex = /@quasaronsol\s+tip\s+(\d+(?:\.\d+)?)\s*(BNB|USDC)?/i;
  const match = text.match(tipRegex);
  
  if (match) {
    return {
      amount: parseFloat(match[1]),
      token: match[2] || 'BNB'
    };
  }
  
  return null;
}

// Parse auto-pay command
function parseAutoPayCommand(text) {
  const autoPayRegex = /#PourboirePay/i;
  return autoPayRegex.test(text);
}

// Parse giveaway command
function parseGiveawayCommand(text) {
  const giveawayRegex = /@quasaronsol\s+pick\s+(random|first|highest)\s+(\d+)\s+replies?\s+and\s+tip\s+(\d+(?:\.\d+)?)\s*(BNB|USDC)?/i;
  const match = text.match(giveawayRegex);
  
  if (match) {
    return {
      type: match[1],
      count: parseInt(match[2]),
      amount: parseFloat(match[3]),
      token: match[4] || 'BNB'
    };
  }
  
  return null;
}

// Check if user A follows user B
async function checkFollowStatus(followerId, followingId) {
  try {
    const followers = await twitterClient.v2.followers(followingId, { max_results: 1000 });
    return followers.data.some(user => user.id === followerId);
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
}

// Process tip command
async function processTipCommand(tweet, senderHandle, recipientHandle) {
  try {
    const tipCommand = parseTipCommand(tweet.text);
    if (!tipCommand) return null;
    
    // Get sender user
    const sender = await getUserByHandle(senderHandle);
    if (!sender) {
      console.log(`Sender ${senderHandle} not found`);
      return null;
    }
    
    // Get or create recipient user
    let recipient = await getUserByHandle(recipientHandle);
    if (!recipient) {
      console.log(`Creating custodial wallet for ${recipientHandle}`);
      const { user } = await createCustodialWallet(recipientHandle);
      recipient = user;
    }
    
    // Decrypt sender's private key
    const password = process.env.ENCRYPTION_KEY || 'default-password';
    const privateKey = decryptPrivateKey(sender.encryptedPrivateKey, sender.nonce, password);
    
    // Send transaction (BNB or BEP-20 token)
    let txHash;
    if (tipCommand.token === 'BNB') {
      txHash = await sendBNB(privateKey, recipient.walletAddress, tipCommand.amount);
    } else {
      // For USDC/USDT, use token contract addresses
      // USDC on BSC: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
      // USDT on BSC: 0x55d398326f99059fF775485246999027B3197955
      const tokenAddresses = {
        'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        'USDT': '0x55d398326f99059fF775485246999027B3197955'
      };
      const tokenAddress = tokenAddresses[tipCommand.token];
      if (!tokenAddress) {
        throw new Error(`Unsupported token: ${tipCommand.token}`);
      }
      txHash = await sendToken(privateKey, recipient.walletAddress, tipCommand.amount, tokenAddress);
    }
    
    // Save transaction record
    const transaction = new Transaction({
      fromUser: senderHandle,
      toUser: recipientHandle,
      amount: tipCommand.amount,
      token: tipCommand.token,
      txHash,
      status: 'confirmed'
    });
    await transaction.save();
    
    // Reply to tweet
    await twitterClient.v2.tweet({
      text: `✅ Tip sent! ${tipCommand.amount} ${tipCommand.token} sent to @${recipientHandle}\nTx: ${txHash}`,
      reply: {
        in_reply_to_tweet_id: tweet.id
      }
    });
    
    return { success: true, txHash };
  } catch (error) {
    console.error('Error processing tip:', error);
    
    // Reply with error
    await twitterClient.v2.tweet({
      text: `❌ Error processing tip: ${error.message}`,
      reply: {
        in_reply_to_tweet_id: tweet.id
      }
    });
    
    return { success: false, error: error.message };
  }
}

// Process giveaway command
async function processGiveawayCommand(tweet, senderHandle) {
  try {
    const giveawayCommand = parseGiveawayCommand(tweet.text);
    if (!giveawayCommand) return null;
    
    // Get conversation replies
    const replies = await twitterClient.v2.search({
      query: `conversation_id:${tweet.conversation_id} -is:retweet`,
      max_results: 100,
      'tweet.fields': ['public_metrics', 'author_id', 'text']
    });
    
    if (!replies.data || replies.data.length === 0) {
      await twitterClient.v2.tweet({
        text: `❌ No replies found for giveaway`,
        reply: { in_reply_to_tweet_id: tweet.id }
      });
      return null;
    }
    
    // Filter replies (exclude the original tweet)
    const validReplies = replies.data.filter(reply => 
      reply.id !== tweet.id && 
      reply.author_id !== tweet.author_id
    );
    
    let winners = [];
    
    switch (giveawayCommand.type) {
      case 'random':
        winners = validReplies.sort(() => 0.5 - Math.random()).slice(0, giveawayCommand.count);
        break;
      case 'first':
        winners = validReplies.slice(0, giveawayCommand.count);
        break;
      case 'highest':
        winners = validReplies
          .sort((a, b) => b.public_metrics.like_count - a.public_metrics.like_count)
          .slice(0, giveawayCommand.count);
        break;
    }
    
    // Get sender user
    const sender = await getUserByHandle(senderHandle);
    if (!sender) {
      console.log(`Sender ${senderHandle} not found`);
      return null;
    }
    
    // Decrypt sender's private key
    const password = process.env.ENCRYPTION_KEY || 'default-password';
    const privateKey = decryptPrivateKey(sender.encryptedPrivateKey, sender.nonce, password);
    
    // Send tips to winners
    const txHashes = [];
    for (const winner of winners) {
      try {
        // Get winner's handle
        const winnerUser = await twitterClient.v2.user(winner.author_id);
        const winnerHandle = winnerUser.data.username;
        
        // Get or create winner's wallet
        let winnerUserRecord = await getUserByHandle(winnerHandle);
        if (!winnerUserRecord) {
          const { user } = await createCustodialWallet(winnerHandle);
          winnerUserRecord = user;
        }
        
        // Send tip (BNB or BEP-20 token)
        let txHash;
        if (giveawayCommand.token === 'BNB') {
          txHash = await sendBNB(privateKey, winnerUserRecord.walletAddress, giveawayCommand.amount);
        } else {
          const tokenAddresses = {
            'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            'USDT': '0x55d398326f99059fF775485246999027B3197955'
          };
          const tokenAddress = tokenAddresses[giveawayCommand.token];
          if (!tokenAddress) {
            throw new Error(`Unsupported token: ${giveawayCommand.token}`);
          }
          txHash = await sendToken(privateKey, winnerUserRecord.walletAddress, giveawayCommand.amount, tokenAddress);
        }
        txHashes.push(txHash);
        
        // Save transaction
        const transaction = new Transaction({
          fromUser: senderHandle,
          toUser: winnerHandle,
          amount: giveawayCommand.amount,
          token: giveawayCommand.token,
          txHash,
          status: 'confirmed'
        });
        await transaction.save();
      } catch (error) {
        console.error(`Error sending tip to winner:`, error);
      }
    }
    
    // Reply with results
    await twitterClient.v2.tweet({
      text: `🎉 Giveaway complete! ${winners.length} winners selected and tipped ${giveawayCommand.amount} ${giveawayCommand.token} each!\nTx hashes: ${txHashes.join(', ')}`,
      reply: { in_reply_to_tweet_id: tweet.id }
    });
    
    return { success: true, winners: winners.length, txHashes };
  } catch (error) {
    console.error('Error processing giveaway:', error);
    
    await twitterClient.v2.tweet({
      text: `❌ Error processing giveaway: ${error.message}`,
      reply: { in_reply_to_tweet_id: tweet.id }
    });
    
    return { success: false, error: error.message };
  }
}

// Monitor Twitter mentions
async function monitorMentions() {
  try {
    console.log('Monitoring Twitter mentions...');
    
    const mentions = await twitterClient.v2.search({
      query: '@quasaronsol -is:retweet',
      max_results: 10,
      'tweet.fields': ['author_id', 'conversation_id', 'text', 'created_at'],
      'user.fields': ['username']
    });
    
    if (!mentions.data) return;
    
    for (const tweet of mentions.data) {
      try {
        // Get tweet author info
        const author = await twitterClient.v2.user(tweet.author_id);
        const authorHandle = author.data.username;
        
        console.log(`Processing mention from @${authorHandle}: ${tweet.text}`);
        
        // Check if it's a tip command
        const tipCommand = parseTipCommand(tweet.text);
        if (tipCommand) {
          // Extract recipient from reply context
          const recipientMatch = tweet.text.match(/@(\w+)/g);
          if (recipientMatch && recipientMatch.length > 1) {
            const recipientHandle = recipientMatch[1].replace('@', '');
            if (recipientHandle.toLowerCase() !== 'quasaronsol') {
              await processTipCommand(tweet, authorHandle, recipientHandle);
            }
          }
          continue;
        }
        
        // Check if it's a giveaway command
        const giveawayCommand = parseGiveawayCommand(tweet.text);
        if (giveawayCommand) {
          await processGiveawayCommand(tweet, authorHandle);
          continue;
        }
        
        // Check for auto-pay triggers
        const autoPayRules = await AutoPayRule.find({ active: true });
        for (const rule of autoPayRules) {
          // This would need more complex logic to check conditions
          // For now, just log that we found auto-pay rules
          console.log(`Found auto-pay rule: ${rule.name}`);
        }
        
      } catch (error) {
        console.error(`Error processing tweet ${tweet.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error monitoring mentions:', error);
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/user/:handle', async (req, res) => {
  try {
    const user = await getUserByHandle(req.params.handle);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      handle: user.twitterHandle,
      walletAddress: user.walletAddress,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions/:handle', async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [
        { fromUser: req.params.handle },
        { toUser: req.params.handle }
      ]
    }).sort({ createdAt: -1 });
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auto-pay', async (req, res) => {
  try {
    const { userId, name, condition, amount, token } = req.body;
    
    const rule = new AutoPayRule({
      userId,
      name,
      condition,
      amount,
      token
    });
    
    await rule.save();
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start monitoring
cron.schedule('*/2 * * * *', monitorMentions); // Every 2 minutes

app.listen(PORT, () => {
  console.log(`Quasar server running on port ${PORT}`);
  console.log(`Monitoring Twitter mentions every 2 minutes...`);
});

