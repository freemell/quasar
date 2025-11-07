'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Plus, Minus, Download, RefreshCw, Copy, Check, ExternalLink } from 'lucide-react';
import { useWeb3Modal } from '@web3modal/wagmi/react';

type HistoryItem = {
  type: 'tip' | 'transfer';
  amount: number;
  token: 'BNB' | 'USDC';
  counterparty: string;
  txHash: string;
  date: string | Date;
};

export default function Dashboard() {
  const { user, login, logout } = usePrivy();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'auto-pay' | 'settings'>('overview'); // Unused but kept for future features
  const [userData, setUserData] = useState<any>(null);
  const [pendingTips, setPendingTips] = useState<any[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [tipAddress, setTipAddress] = useState<string | null>(null);
  const [showFund, setShowFund] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fundAmount, setFundAmount] = useState<string>("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawAddress, setWithdrawAddress] = useState<string>("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [bnbPrice, setBnbPrice] = useState<number>(300); // Default to $300 if fetch fails
  // Wagmi hooks for BSC wallet connection
  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const { open } = useWeb3Modal();
  const { sendTransaction, data: hash, isPending: isPendingTx } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Fetch BNB price from CoinGecko
  useEffect(() => {
    const fetchBnbPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
        const data = await response.json();
        if (data?.binancecoin?.usd) {
          setBnbPrice(data.binancecoin.usd);
        }
      } catch (error) {
        console.error('Failed to fetch BNB price, using default:', error);
        // Keep default price
      }
    };
    fetchBnbPrice();
    // Refresh price every 5 minutes
    const interval = setInterval(fetchBnbPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getBSCAddress = (u: any): string | null => {
    if (!u) return null;
    // Prefer primary wallet if it's BSC/EVM
    const primary = (u as any).wallet;
    if (primary?.address && (primary as any).chainType !== 'solana') return primary.address;
    // Search linked accounts for an EVM wallet (BSC/Ethereum)
    const linked = (u as any).linkedAccounts || [];
    const evm = linked.find((a: any) => a.type === 'wallet' && a.chainType !== 'solana');
    if (evm?.address) return evm.address;
    // Fallback to wagmi connected address
    return address || null;
  };

  const formatAddress = (addr?: string | null) => {
    if (!addr) return '';
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  // Client-side rendering check
  useEffect(() => { setIsClient(true); }, []);

  const ensureTipAccount = async (handle: string) => {
    try {
      console.log('ensureTipAccount called with handle:', handle);
      
      // Get Twitter ID from user's linked accounts if available
      const twitterAccount = user?.linkedAccounts?.find((a: any) => a.type === 'twitter_oauth') as any;
      const twitterId = twitterAccount?.subject || twitterAccount?.providerId || undefined;
      
      // Don't pass Privy embedded wallet - we want to find/create the custodial wallet
      console.log('Fetching custodial wallet for:', { handle, twitterId });
      
      const res = await fetch('/api/wallet/ensure-tip-account', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          handle,
          twitterId
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('ensure-tip-account failed:', errorText);
        // Don't fall back to Privy embedded wallet - we need the custodial wallet
        // The API should always return a wallet address for registered users
        return;
      }
      const data = await res.json();
      if (data?.walletAddress) {
        // Always use the custodial wallet from the database, never Privy embedded wallet
        setTipAddress(data.walletAddress);
        await fetchWalletBalance(data.walletAddress);
        await fetchPendingAndHistory(data.walletAddress);
        console.log('Set tip address from database:', data.walletAddress);
      } else {
        console.error('ensure-tip-account returned no walletAddress:', data);
      }
    } catch (e) {
      console.error('ensure-tip-account error', e);
      // Don't fall back to Privy embedded wallet - we need the custodial wallet
    }
  };

  // Fetch balance from embedded/custodial wallet
  useEffect(() => {
    if (!user) {
      setTipAddress(null);
      setBalance(0);
      setLoading(false);
      setPendingTips([]);
      setHistory([]);
      return;
    }
    const handle = userData?.handle;
    if (handle) {
      console.log('Calling ensureTipAccount with handle:', handle);
      ensureTipAccount(handle);
    } else {
      console.warn('No handle found in userData, waiting for userData to be set...');
    }
  }, [user, userData?.handle]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && hash && tipAddress) {
      fetchWalletBalance(tipAddress);
      setShowFund(false);
      setFundAmount('');
    }
  }, [isConfirmed, hash, tipAddress]);

  // Handle user profile from Privy linked accounts
  useEffect(() => {
    if (user) {
      const twitterAccount = user.linkedAccounts.find((a: any) => a.type === 'twitter_oauth') as any;
      const emailAccount = user.linkedAccounts.find((a: any) => a.type === 'email') as any;
      if (twitterAccount) {
        const handle = twitterAccount?.username ? `@${twitterAccount.username}` : '';
        const name = twitterAccount?.name || handle || 'User';
        const profileImage = twitterAccount?.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff`;
        setUserData({
          id: user.id,
          handle,
          name,
          profileImage,
          bio: '',
          walletAddress: getBSCAddress(user) || '',
          isEmbedded: true,
        });
      } else if (emailAccount) {
        const name = emailAccount.address.split('@')[0];
        setUserData({
          id: user.id,
          handle: emailAccount.address,
          name,
          profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff`,
          bio: 'Connected via email',
          walletAddress: getBSCAddress(user) || '',
          isEmbedded: true,
        });
      }
    } else {
      setUserData(null);
    }
  }, [user]);

  // Fetch real wallet balance
  const fetchWalletBalance = async (walletAddress: string) => {
    try {
      const response = await fetch(`/api/wallet/balance?address=${walletAddress}`);
      const data = await response.json();
      if (data.success) setBalance(data.bnb.amount);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const fetchPendingAndHistory = async (walletAddress: string) => {
    try {
      const res = await fetch(`/api/tips/pending?walletAddress=${walletAddress}`);
      const data = await res.json();
      if (data.success) {
        setPendingTips((data.pending || []).map((p: any) => ({
          id: p._id || p.id,
          amount: p.amount,
          token: p.token,
          sender: p.sender,
          tweetId: p.fromTx,
          timestamp: new Date(),
          status: 'pending'
        })));
        setHistory((data.history || []).map((h: any) => ({ ...h })));
        setDbUserId(data.user?.id || null);
      }
    } catch (e) {
      console.error('Failed to fetch pending/history', e);
    }
  };

  const claimTip = async (tipId: string) => {
    try {
      if (!dbUserId) {
        console.error('Claim failed: User ID not found');
        return;
      }
      const res = await fetch('/api/tips/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: dbUserId, tipId })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Claim failed:', data.error || 'Unknown error');
        return;
      }
      if (data.success) {
        setPendingTips(prev => prev.filter(t => (t.id || t._id) !== tipId));
        // refresh history after claim
        const addr = getBSCAddress(user);
        if (addr) fetchPendingAndHistory(addr);
      }
    } catch (e: any) {
      console.error('Claim failed', e);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatAmount = (amount: number, token: string) => {
    return `${amount} ${token}`;
  };

  // Show loading state during hydration
  if (!isClient) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1d18] via-black to-[#2a2e26]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#6b5545]/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#c8b4a0]/10 rounded-full blur-2xl"></div>
        </div>
        <div className="relative z-10 min-h-screen text-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/70 font-light">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background with gradient matching Quasar theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1d18] via-black to-[#2a2e26]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#6b5545]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#c8b4a0]/10 rounded-full blur-2xl"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10 min-h-screen text-white">
        {/* Header */}
        <header className="border-b border-[#c8b4a0]/10 bg-[#1a1d18]/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                    <h1 className="text-3xl font-extralight tracking-tight">Quasar Dashboard</h1>
              <span className="px-3 py-1 bg-[#6b5545]/20 text-[#c8b4a0] rounded-full text-xs font-light">
                Live
              </span>
              <a href="https://x.com/Quasaronsol" target="_blank" rel="noreferrer" className="px-3 py-1 bg-[#6b5545]/20 text-[#c8b4a0] rounded-full text-xs font-light hover:bg-[#8a7060]/30">
                Follow on X
              </a>
              {userData && (
                <span className="px-3 py-1 bg-[#6b5545]/20 text-[#c8b4a0] rounded-full text-xs font-light">
                  {userData.handle}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-green-400">
                    <span className="text-sm font-light">✓ X Connected</span>
                  </div>
                  <button
                    onClick={() => logout()}
                    className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl transition-colors font-light tracking-tight"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => login()}
                  className="bg-[#6b5545] hover:bg-[#8a7060] text-white py-2 px-4 rounded-xl transition-colors font-light tracking-tight"
                >
                  Connect Account
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!user ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-[#c8b4a0] to-[#a89080] rounded-full flex items-center justify-center">
              <span className="text-3xl">🔗</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">Connect your account</h2>
            <p className="text-white/70 mb-8 max-w-md mx-auto">
              Connect your account to start sending and receiving tips. Twitter login preferred, but email works too.
            </p>
            <button
              onClick={() => login()}
              className="bg-[#6b5545] hover:bg-[#8a7060] text-white py-3 px-8 rounded-xl transition-colors text-lg font-light tracking-tight"
            >
              Connect Account
            </button>
          </div>
        ) : (
          <>
            {/* Main Profile Card - Matching Reference Layout */}
            {userData && (
              <div className="bg-gradient-to-br from-[#1a1d18]/80 to-[#2a2e26]/80 border border-[#c8b4a0]/10 rounded-2xl p-8 mb-8 backdrop-blur-sm shadow-2xl">
                {/* Profile Info Row */}
                <div className="flex items-center space-x-4 mb-8">
                  <img
                    src={userData.profileImage || '/default-avatar.png'}
                    alt={userData.name}
                    className="w-16 h-16 rounded-full border-2 border-[#c8b4a0]/20 object-cover"
                  />
                  <div>
                    <h2 className="text-2xl font-extralight tracking-tight text-[#e6e1d7]">{userData.name || 'User'}</h2>
                    <p className="text-[#c8b4a0] text-sm font-light">{userData.handle || '@username'}</p>
                  </div>
                </div>

                {/* Balance Section - Prominently Displayed */}
                <div className="mb-8">
                  <div className="text-sm text-[#c8b4a0]/70 font-light mb-2">$ Your Balance</div>
                  <div className="text-5xl font-extralight tracking-tight text-[#c8b4a0] mb-2">
                    {loading ? '...' : `${balance.toFixed(4)} BNB`}
                  </div>
                  <div className="text-sm text-[#a89080] font-light">
                    ≈ ${(balance * bnbPrice).toFixed(2)} USD
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 mb-8">
                  <button 
                    onClick={async () => { setShowFund(true); if (userData?.handle) { try { await ensureTipAccount(userData.handle); } catch (e) { console.error('ensureTipAccount failed', e); } } }}
                    className="flex-1 bg-[#6b5545] hover:bg-[#8a7060] text-white py-3 px-6 rounded-lg transition-colors font-light tracking-tight flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Funds
                  </button>
                  <button 
                    onClick={() => setShowWithdraw(true)}
                    className="flex-1 border border-[#c8b4a0]/30 hover:bg-white/5 text-[#e6e1d7] py-3 px-6 rounded-lg transition-colors font-light tracking-tight flex items-center justify-center gap-2"
                  >
                    <Minus className="w-4 h-4" />
                    Withdraw
                  </button>
                </div>

                {/* Wallet Address Section */}
                <div className="space-y-4 pt-6 border-t border-[#c8b4a0]/10">
                  <div>
                    <div className="text-xs text-[#c8b4a0]/70 font-light mb-2">Wallet Address</div>
                    <div className="flex items-center justify-between bg-[#1a1d18]/50 rounded-lg p-3 border border-[#c8b4a0]/10">
                      <span className="font-mono text-sm text-[#e6e1d7]">
                        {tipAddress ? formatAddress(tipAddress) : 'Loading...'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (tipAddress) { 
                              navigator.clipboard.writeText(tipAddress); 
                              setCopied(true); 
                              setTimeout(()=>setCopied(false),1000); 
                            }
                          }}
                          className="p-2 hover:bg-white/10 rounded transition-colors"
                          title="Copy"
                        >
                          {copied ? <Check className="w-4 h-4 text-[#c8b4a0]" /> : <Copy className="w-4 h-4 text-[#c8b4a0]" />}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/wallet/export', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ handle: userData.handle })
                              });
                              const data = await response.json();
                              if (data.success && data.exportData) {
                                const blob = new Blob([JSON.stringify(data.exportData, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'quasar-wallet-export.json';
                                a.click();
                                URL.revokeObjectURL(url);
                              }
                            } catch (e) {
                              console.error('export error', e);
                            }
                          }}
                          className="p-2 hover:bg-white/10 rounded transition-colors"
                          title="Export Wallet"
                        >
                          <Download className="w-4 h-4 text-[#c8b4a0]" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contract Address (if applicable) */}
                  <div>
                    <div className="text-xs text-[#c8b4a0]/70 font-light mb-2">Contract Address</div>
                    <div className="flex items-center justify-between bg-[#1a1d18]/50 rounded-lg p-3 border border-[#c8b4a0]/10">
                      <span className="font-mono text-sm text-[#e6e1d7]">
                        {tipAddress ? formatAddress(tipAddress) : 'N/A'}
                      </span>
                      <button
                        onClick={() => {
                          if (tipAddress) { 
                            navigator.clipboard.writeText(tipAddress); 
                            setCopied(true); 
                            setTimeout(()=>setCopied(false),1000); 
                          }
                        }}
                        className="p-2 hover:bg-white/10 rounded transition-colors"
                        title="Copy"
                      >
                        {copied ? <Check className="w-4 h-4 text-[#c8b4a0]" /> : <Copy className="w-4 h-4 text-[#c8b4a0]" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Wallet Transaction History Section */}
            <div className="bg-[#1a1d18]/50 border border-[#c8b4a0]/10 rounded-2xl overflow-hidden backdrop-blur-sm">
              {/* Header with Refresh Button */}
              <div className="flex items-center justify-between p-6 border-b border-[#c8b4a0]/10">
                <h3 className="text-xl font-extralight tracking-tight text-[#e6e1d7]">Wallet Transaction History</h3>
                <button
                  onClick={async () => {
                    if (tipAddress) {
                      await fetchPendingAndHistory(tipAddress);
                      await fetchWalletBalance(tipAddress);
                    }
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5 text-[#c8b4a0]" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex border-b border-[#c8b4a0]/10">
                {['All', 'Sent', 'Received'].map((filter) => (
                  <button
                    key={filter}
                    className={`px-6 py-4 font-light transition-colors ${
                      filter === 'All'
                        ? 'bg-[#6b5545]/20 text-[#c8b4a0] border-b-2 border-[#c8b4a0]'
                        : 'text-[#a89080] hover:text-[#c8b4a0] hover:bg-white/5'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Transaction List */}
              <div className="p-6">
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[#c8b4a0]/70 font-light">No transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((tx, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-[#2a2e26]/50 rounded-lg border border-[#c8b4a0]/5 hover:bg-[#2a2e26] transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            tx.type === 'transfer' ? 'bg-[#6b5545]/20' : 'bg-[#c8b4a0]/20'
                          }`}>
                            {tx.type === 'transfer' ? (
                              <Minus className="w-5 h-5 text-[#c8b4a0]" />
                            ) : (
                              <Plus className="w-5 h-5 text-[#c8b4a0]" />
                            )}
                          </div>
                          <div>
                            <div className="text-[#e6e1d7] font-light">
                              {tx.type === 'transfer' ? 'Sent to' : 'Received from'} {tx.counterparty}
                            </div>
                            <div className="text-sm text-[#a89080] font-light flex items-center gap-2">
                              <span>{formatDate(new Date(tx.date))}</span>
                              <a 
                                href={`https://bscscan.com/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#c8b4a0] hover:text-[#e6e1d7] flex items-center gap-1"
                              >
                                View on BscScan
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-light ${
                            tx.type === 'transfer' ? 'text-[#c8b4a0]' : 'text-[#c8b4a0]'
                          }`}>
                            {tx.type === 'transfer' ? '-' : '+'}{formatAmount(tx.amount, tx.token)}
                          </div>
                          <div className="text-xs text-[#a89080] capitalize font-light">
                            {tx.type}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Additional Settings/Features (Hidden by default, can be shown via tabs if needed) */}
            {false && (
              <div className="space-y-6">
                <h3 className="text-lg font-extralight tracking-tight">Settings</h3>
                
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                  <h4 className="font-light mb-4">X (Twitter) Integration</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-light">
                          {user ? 'Account Connected' : 'Connect Account'}
                        </div>
                        <div className="text-sm text-white/70 font-light">
                          {user ? 
                            `Connected: ${userData?.handle} - Tip wallet auto-created` :
                            'Link your X account to get started'
                          }
                        </div>
                      </div>
                      {user ? (
                        <div className="flex items-center space-x-2 text-green-400">
                          <span className="text-sm">✓ Connected</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => login()}
                          className="bg-[#6b5545] hover:bg-[#8a7060] text-white py-2 px-4 rounded-lg transition-colors"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                  <h4 className="font-light mb-4">Wallet Tools</h4>
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowWithdraw(true)}
                      className="bg-[#6b5545] hover:bg-[#8a7060] text-white py-2 px-4 rounded-lg transition-colors font-light tracking-tight w-full"
                    >
                      Withdraw BNB from Tip Wallet
                    </button>
                    <div className="text-xs text-white/60 mb-3">
                      Transfer BNB from your tip wallet to another address
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (!userData?.handle) return;
                          const res = await fetch('/api/wallet/export', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ handle: userData.handle })
                          });
                          const data = await res.json();
                          if (!res.ok || !data.success) {
                            console.error('Export failed:', data.error || 'Unknown error');
                            return;
                          }
                          const blob = new Blob([
                            JSON.stringify({
                              address: data.walletAddress,
                              privateKeyHex: data.privateKeyHex,
                              note: 'Keep this file secret. Anyone with this key can spend your funds.'
                            }, null, 2)
                          ], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'quasar-wallet-export.json';
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (e) {
                          console.error('export error', e);
                        }
                      }}
                      className="bg-red-500/90 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors font-light tracking-tight w-full"
                    >
                      Export Custodial Wallet (Dev only)
                    </button>
                    <div className="text-xs text-white/60">Only available in development and for custodial wallets.</div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                  <h4 className="font-light mb-4">Notification Preferences</h4>
                  <div className="space-y-4">
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="w-4 h-4 text-[#c8b4a0] rounded" defaultChecked />
                      <span className="font-light">Email notifications for received tips</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="w-4 h-4 text-[#c8b4a0] rounded" defaultChecked />
                      <span className="font-light">Push notifications for auto-pay triggers</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="w-4 h-4 text-[#c8b4a0] rounded" />
                      <span className="font-light">Weekly summary emails</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>
      {showFund && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-md text-white">
            <h3 className="text-xl font-extralight mb-2">Fund Tip Account</h3>
            <p className="text-white/70 text-sm mb-4">Send BNB to your deposit address. This funds your tipping account.</p>
            <button
              onClick={() => { if (tipAddress) { navigator.clipboard.writeText(tipAddress); setCopied(true); setTimeout(()=>setCopied(false),1000); }}}
              className="bg-black/50 rounded-xl px-4 py-3 font-mono text-sm w-full text-left hover:bg-black/60 transition"
              title="Copy"
            >
              {tipAddress ? formatAddress(tipAddress) : '...'}
            </button>
            <div className="mt-4 flex items-center gap-3">
              {tipAddress && (
                <a href={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tipAddress)}`} target="_blank" rel="noreferrer" className="px-3 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition">QR</a>
              )}
              <div className="flex-1" />
              <button onClick={() => setShowFund(false)} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg">Close</button>
            </div>
            <div className="mt-4">
              <label className="text-sm text-white/70">Amount (BNB)</label>
              <input value={fundAmount} onChange={(e)=>setFundAmount(e.target.value)} placeholder="e.g. 0.5" className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none" />
              {tipAddress && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => open()}
                    className="w-full px-3 py-2 bg-[#6b5545] hover:bg-[#8a7060] text-white rounded-lg h-11"
                  >
                    {isConnected ? 'Connected' : 'Connect Wallet'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!address || !tipAddress || !fundAmount) return;
                      try {
                        const amount = parseEther(fundAmount);
                        
                        // Send BNB transaction using wagmi
                        sendTransaction({
                          to: tipAddress as `0x${string}`,
                          value: amount,
                        });
                      } catch (e: any) {
                        const msg = e?.message || String(e);
                        if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
                          console.error('Insufficient funds: Connected wallet needs sufficient BNB to cover network fee and amount.');
                        }
                        console.error('Transfer failed:', msg);
                        console.error('transfer error', e);
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#6b5545] hover:bg-[#8a7060] rounded-lg disabled:opacity-50"
                    disabled={!isConnected || !fundAmount || isPendingTx || isConfirming}
                  >
                    {isPendingTx || isConfirming ? 'Processing...' : 'Transfer to Tip Wallet'}
                  </button>
                  <a
                    href={`https://bscscan.com/address/${tipAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full px-3 py-2 border border-white/20 hover:bg-white/10 rounded-lg inline-flex items-center justify-center"
                  >
                    View on BscScan
                  </a>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-md text-white">
            <h3 className="text-xl font-extralight mb-2">Withdraw BNB from Tip Wallet</h3>
            <p className="text-white/70 text-sm mb-4">
              Transfer BNB from your custodial tip wallet to another address
            </p>
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400/90 text-xs">
                ⚠️ Remember to leave a small amount of BNB (~0.001 BNB) in your tip wallet for transaction fees
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/70 mb-1 block">Amount (BNB)</label>
                <input
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="e.g. 0.5"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none"
                  disabled={withdrawing}
                />
              </div>
              
              <div>
                <label className="text-sm text-white/70 mb-1 block">Recipient Address</label>
                <input
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="Enter BSC address"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none font-mono text-sm"
                  disabled={withdrawing}
                />
                {isConnected && address && (
                  <button
                    onClick={() => setWithdrawAddress(address)}
                    className="mt-2 text-xs text-[#c8b4a0] hover:text-[#e6e1d7]"
                    disabled={withdrawing}
                  >
                    Use Connected Wallet
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowWithdraw(false);
                    setWithdrawAmount("");
                    setWithdrawAddress("");
                  }}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  disabled={withdrawing}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!userData?.handle || !withdrawAmount || !withdrawAddress) {
                      console.error('Withdraw: Missing required fields');
                      return;
                    }
                    
                    setWithdrawing(true);
                    try {
                      const res = await fetch('/api/wallet/withdraw', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          handle: userData.handle,
                          amount: withdrawAmount,
                          toAddress: withdrawAddress
                        })
                      });
                      
                      const data = await res.json();
                      
                      if (!res.ok) {
                        const errorMsg = data.details || data.error || 'Withdrawal failed';
                        console.error('Withdraw failed:', errorMsg);
                        return;
                      }
                      
                      console.log(`Withdrawal successful! Tx: ${data.txHash}\n\nView on BscScan: ${data.bscscanUrl}`);
                      
                      // Refresh balance and history
                      if (tipAddress) {
                        await fetchWalletBalance(tipAddress);
                        await fetchPendingAndHistory(tipAddress);
                      }
                      
                      setShowWithdraw(false);
                      setWithdrawAmount("");
                      setWithdrawAddress("");
                    } catch (e: any) {
                      console.error('withdraw error', e);
                    } finally {
                      setWithdrawing(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-[#6b5545] hover:bg-[#8a7060] rounded-lg transition-colors disabled:opacity-50"
                  disabled={withdrawing || !withdrawAmount || !withdrawAddress}
                >
                  {withdrawing ? 'Processing...' : 'Withdraw'}
                </button>
              </div>
              
              {tipAddress && (
                <div className="mt-4 p-3 bg-black/40 rounded-lg">
                  <div className="text-xs text-white/70 mb-1">Tip Wallet Balance</div>
                  <div className="text-sm font-mono">{balance.toFixed(4)} BNB</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}