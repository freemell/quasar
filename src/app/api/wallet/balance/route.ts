import { NextRequest, NextResponse } from 'next/server';
import Web3 from 'web3';
import { ethers } from 'ethers';

// Create Web3 instance per request to use fresh RPC URL
function getWeb3() {
  const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
  return new Web3(rpcUrl);
}

function getProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
  return new ethers.JsonRpcProvider(rpcUrl);
}

// Standard ERC-20 ABI for balanceOf
const ERC20_ABI = [
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
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate BSC address format
    if (!Web3.utils.isAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const web3 = getWeb3();
    const provider = getProvider();
    
    // Get BNB balance
    const balanceWei = await web3.eth.getBalance(walletAddress);
    const bnbBalanceFormatted = parseFloat(web3.utils.fromWei(balanceWei, 'ether'));

    // Known BEP-20 token addresses on BSC
    const tokenAddresses = {
      'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      'USDT': '0x55d398326f99059fF775485246999027B3197955',
      'BUSD': '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
    };

    const tokenBalances = [];
    
    // Check balance for each known token
    for (const [symbol, tokenAddress] of Object.entries(tokenAddresses)) {
      try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(walletAddress);
        const decimals = await tokenContract.decimals();
        const amount = parseFloat(ethers.formatUnits(balance, decimals));
        
        if (amount > 0) {
          tokenBalances.push({
            mint: tokenAddress,
            symbol: symbol,
            amount: amount,
            decimals: decimals
          });
        }
      } catch (error) {
        // Skip tokens we can't process
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      bnb: {
        amount: bnbBalanceFormatted,
        symbol: 'BNB',
        decimals: 18
      },
      tokens: tokenBalances
    });

  } catch (error) {
    console.error('Get balance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}



