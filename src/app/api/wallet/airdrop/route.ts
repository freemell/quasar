import { NextRequest, NextResponse } from 'next/server';
import Web3 from 'web3';

// Note: BSC doesn't have airdrops like Solana devnet
// This endpoint is kept for compatibility but will return an error
// In production, users should fund their wallets through exchanges or faucets

export async function POST(req: NextRequest) {
  try {
    const { address, amount } = await req.json();
    if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });
    
    // Validate BSC address format
    if (!Web3.utils.isAddress(address)) {
      return NextResponse.json({ error: 'Invalid BSC address format' }, { status: 400 });
    }
    
    // Only allow on testnet
    const rpc = (process.env.NEXT_PUBLIC_BSC_RPC_URL || '').toLowerCase();
    if (!rpc.includes('testnet') && !rpc.includes('prebsc')) {
      return NextResponse.json({ error: 'Airdrop allowed only on BSC testnet' }, { status: 400 });
    }
    
    // BSC doesn't support airdrops natively
    // In a real implementation, you would need to:
    // 1. Have a funded wallet with BNB
    // 2. Send BNB from that wallet to the recipient address
    // For now, return an error indicating airdrops aren't supported
    
    return NextResponse.json({ 
      error: 'Airdrops not supported on BSC. Please fund your wallet through an exchange or faucet.',
      note: 'BSC testnet faucet: https://testnet.binance.org/faucet-smart'
    }, { status: 400 });
  } catch (e: any) {
    console.error('airdrop error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


