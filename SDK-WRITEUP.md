# 🚀 Introducing Pourboire SDK

## Tip anyone on X with Solana — Now with Developer SDK!

We're excited to announce the **Pourboire SDK** — a powerful TypeScript SDK that lets you integrate Solana tipping directly into your applications.

### What can you do?

**💰 Wallet Management**
- Get wallet balances (SOL & SPL tokens)
- Create and manage custodial tip wallets
- Withdraw SOL from tip wallets

**🎁 Tip Operations**
- Claim pending tips
- Check pending tips and transaction history
- Manage tip accounts seamlessly

### Quick Start

```typescript
import { PourboireSDK } from '@pourboire/sdk';

const sdk = new PourboireSDK('https://pourboire.tips');

// Get wallet balance
const balance = await sdk.getBalance(walletAddress);
console.log(`SOL: ${balance.sol.amount}`);

// Ensure user has tip wallet
const wallet = await sdk.ensureTipAccount('@username', twitterId);
console.log(`Wallet: ${wallet.walletAddress}`);

// Withdraw SOL
const result = await sdk.withdraw('@username', recipientAddress, 0.5);
console.log(`Transaction: ${result.solscanUrl}`);

// Get pending tips
const tips = await sdk.getPendingTips(walletAddress);
console.log(`Pending: ${tips.pending.length} tips`);
```

### Key Features

✨ **Type-Safe** — Full TypeScript support  
🔒 **Secure** — Handles all wallet operations safely  
⚡ **Simple** — Easy-to-use API  
🌐 **Universal** — Works in any JavaScript/TypeScript project

### Use Cases

- Build custom tip interfaces
- Integrate tipping into your dApp
- Create automation workflows
- Build tip analytics dashboards
- Develop custom notification systems

### Coming Soon

- Node.js package (`npm install @pourboire/sdk`)
- React hooks for easy integration
- Webhook support for real-time events
- Advanced filtering and querying

**Start building the future of social tipping today! 🎯**

---

*Built with ❤️ by the Pourboire team*




