/**
 * Quasar SDK
 * 
 * TypeScript SDK for interacting with the Quasar tipping platform.
 * Enables developers to integrate Binance Smart Chain tipping functionality into their applications.
 * 
 * @module QuasarSDK
 */

export interface WalletBalance {
  bnb: {
    amount: number;
    symbol: string;
    decimals: number;
  };
  tokens: Array<{
    mint: string;
    symbol: string;
    amount: number;
    decimals: number;
  }>;
}

export interface TipWallet {
  walletAddress: string;
  created: boolean;
  foundByWallet?: boolean;
  wasPreCreated?: boolean;
}

export interface WithdrawResult {
  success: boolean;
  txHash: string;
  amount: number;
  from: string;
  to: string;
  bscscanUrl: string;
}

export interface ClaimTipResult {
  success: boolean;
  txHash: string;
  message: string;
}

export interface PendingTip {
  _id: string;
  amount: number;
  token: string;
  fromTx: string;
  sender: string;
}

export interface UserData {
  id: string;
  twitterId: string;
  handle: string;
  name: string;
  profileImage: string;
  walletAddress: string;
  isEmbedded: boolean;
}

export interface PendingTipsResponse {
  success: boolean;
  user: UserData | null;
  pending: PendingTip[];
  history: any[];
}

export class QuasarSDK {
  private baseUrl: string;

  /**
   * Initialize the Quasar SDK
   * 
   * @param baseUrl - The base URL of the Quasar API (defaults to production)
   * @example
   * ```typescript
   * const sdk = new QuasarSDK('https://quasar.tips');
   * ```
   */
  constructor(baseUrl: string = 'https://quasar.tips') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Get wallet balance for a given BSC address
   * 
   * @param walletAddress - The BSC wallet address to check
   * @returns Promise resolving to wallet balance (BNB and BEP-20 tokens)
   * @example
   * ```typescript
   * const balance = await sdk.getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
   * console.log(`BNB Balance: ${balance.bnb.amount}`);
   * ```
   */
  async getBalance(walletAddress: string): Promise<WalletBalance> {
    const response = await fetch(`${this.baseUrl}/api/wallet/balance?address=${encodeURIComponent(walletAddress)}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch balance' }));
      throw new Error(error.error || `HTTP ${response.status}: Failed to fetch balance`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch balance');
    }

    return {
      bnb: data.bnb,
      tokens: data.tokens || []
    };
  }

  /**
   * Ensure a user has a tip wallet account (creates one if needed)
   * 
   * @param handle - Twitter handle (with or without @)
   * @param twitterId - Optional Twitter ID for lookup
   * @param walletAddress - Optional existing wallet address
   * @returns Promise resolving to tip wallet information
   * @example
   * ```typescript
   * const wallet = await sdk.ensureTipAccount('@username', 'twitter_123');
   * console.log(`Wallet address: ${wallet.walletAddress}`);
   * ```
   */
  async ensureTipAccount(
    handle: string,
    twitterId?: string,
    walletAddress?: string
  ): Promise<TipWallet> {
    const response = await fetch(`${this.baseUrl}/api/wallet/ensure-tip-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        twitterId,
        walletAddress
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to ensure tip account' }));
      throw new Error(error.error || `HTTP ${response.status}: Failed to ensure tip account`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to ensure tip account');
    }

    return {
      walletAddress: data.walletAddress,
      created: data.created || false,
      foundByWallet: data.foundByWallet,
      wasPreCreated: data.wasPreCreated
    };
  }

  /**
   * Withdraw BNB from a user's custodial tip wallet
   * 
   * @param handle - User's Twitter handle
   * @param toAddress - Recipient BSC address
   * @param amount - Amount in BNB (number or string)
   * @returns Promise resolving to withdrawal transaction details
   * @example
   * ```typescript
   * const result = await sdk.withdraw('@username', recipientAddress, 0.5);
   * console.log(`Transaction: ${result.txHash}`);
   * console.log(`View on BscScan: ${result.bscscanUrl}`);
   * ```
   */
  async withdraw(
    handle: string,
    toAddress: string,
    amount: number | string
  ): Promise<WithdrawResult> {
    const response = await fetch(`${this.baseUrl}/api/wallet/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        toAddress,
        amount: typeof amount === 'string' ? parseFloat(amount) : amount
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || `HTTP ${response.status}: Withdrawal failed`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Withdrawal failed');
    }

    return {
      success: true,
      txHash: data.txHash,
      amount: data.amount,
      from: data.from,
      to: data.to,
      bscscanUrl: data.bscscanUrl
    };
  }

  /**
   * Claim a pending tip
   * 
   * @param userId - User's MongoDB ID
   * @param tipId - Pending tip's ID
   * @returns Promise resolving to claim result
   * @example
   * ```typescript
   * const result = await sdk.claimTip(userId, tipId);
   * console.log(`Tip claimed: ${result.message}`);
   * ```
   */
  async claimTip(userId: string, tipId: string): Promise<ClaimTipResult> {
    const response = await fetch(`${this.baseUrl}/api/tips/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        tipId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: Failed to claim tip`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to claim tip');
    }

    return {
      success: true,
      txHash: data.txHash,
      message: data.message
    };
  }

  /**
   * Get pending tips and user data for a wallet address
   * 
   * @param walletAddress - The wallet address to check
   * @returns Promise resolving to user data, pending tips, and transaction history
   * @example
   * ```typescript
   * const data = await sdk.getPendingTips(walletAddress);
   * console.log(`Pending tips: ${data.pending.length}`);
   * console.log(`Transaction history: ${data.history.length}`);
   * ```
   */
  async getPendingTips(walletAddress: string): Promise<PendingTipsResponse> {
    const response = await fetch(`${this.baseUrl}/api/tips/pending?walletAddress=${encodeURIComponent(walletAddress)}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch pending tips' }));
      throw new Error(error.error || `HTTP ${response.status}: Failed to fetch pending tips`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch pending tips');
    }

    return {
      success: true,
      user: data.user,
      pending: data.pending || [],
      history: data.history || []
    };
  }

  /**
   * Create a custodial wallet for a user (typically used by the system)
   * 
   * @param handle - Twitter handle
   * @param twitterId - Optional Twitter ID
   * @returns Promise resolving to wallet information
   * @example
   * ```typescript
   * const wallet = await sdk.createCustodialWallet('@username', 'twitter_123');
   * console.log(`New wallet created: ${wallet.walletAddress}`);
   * ```
   */
  async createCustodialWallet(
    handle: string,
    twitterId?: string
  ): Promise<TipWallet> {
    const response = await fetch(`${this.baseUrl}/api/wallet/create-custodial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        twitterId
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create custodial wallet' }));
      throw new Error(error.error || `HTTP ${response.status}: Failed to create custodial wallet`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create custodial wallet');
    }

    return {
      walletAddress: data.walletAddress,
      created: data.created || true
    };
  }
}

/**
 * Default SDK instance (using production URL)
 */
export const quasarSDK = new QuasarSDK();

/**
 * Create a custom SDK instance
 * 
 * @param baseUrl - Custom base URL for the API
 * @returns New SDK instance
 * @example
 * ```typescript
 * const customSDK = createSDK('https://dev.quasar.tips');
 * ```
 */
export function createSDK(baseUrl: string): QuasarSDK {
  return new QuasarSDK(baseUrl);
}



