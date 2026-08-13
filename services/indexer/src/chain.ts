import { createPublicClient, http, defineChain } from 'viem';
import { config } from './config.js';

export const robinhoodTestnet = defineChain({
  id: config.chainId,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' },
  },
});

export const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(config.rpcUrl, { timeout: 30_000 }),
});
