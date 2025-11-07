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

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const modalProjectId = projectId ?? 'demo';

const connectors = [
  injected(),
  metaMask(),
  ...(projectId
    ? [
        walletConnect({
          projectId,
          showQrModal: true,
        }),
      ]
    : []),
];

// Create wagmi config
const config = createConfig({
  chains,
  connectors,
  transports: {
    [bsc.id]: http(rpcUrl),
    [bscTestnet.id]: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
  },
});

try {
  createWeb3Modal({
    wagmiConfig: config,
    projectId: modalProjectId,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-color-mix': '#6b5545',
      '--w3m-color-mix-strength': 20,
    },
  });
  if (!projectId) {
    console.warn(
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect modal is running in demo mode. Generate a project at https://cloud.reown.com and add the ID to your environment variables.'
    );
  }
} catch (error) {
  console.error('Failed to initialize Web3Modal', error);
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
