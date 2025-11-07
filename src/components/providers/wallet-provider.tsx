'use client';

import { FC, ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWeb3Modal } from '@web3modal/wagmi/react';

// BSC Mainnet Chain ID: 56
// BSC Testnet Chain ID: 97
const chains = [bsc, bscTestnet] as const;

// Get RPC URL from environment
const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.binance.org';

// Create wagmi config
const config = createConfig({
  chains,
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ 
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
      showQrModal: true
    }),
  ],
  transports: {
    [bsc.id]: http(rpcUrl),
    [bscTestnet.id]: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
  },
});

// Create Web3Modal
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
if (projectId) {
  createWeb3Modal({
    wagmiConfig: config,
    projectId,
    chains,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-color-mix': '#6b5545',
      '--w3m-color-mix-strength': 20,
    },
  });
}

// Create React Query client
const queryClient = new QueryClient();

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
};
