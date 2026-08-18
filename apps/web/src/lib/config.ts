import { createConfig, injected } from 'wagmi'
import { http } from 'wagmi'
import { defineChain } from 'viem'

export const robinhoodMainnet = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
})

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' },
  },
  testnet: true,
})

export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '4663')
export const activeChain = CHAIN_ID === 46630 ? robinhoodTestnet : robinhoodMainnet

export const BOARD_ADDRESS              = (process.env.NEXT_PUBLIC_BOARD_ADDRESS              ?? '') as `0x${string}`
export const REWARD_ACCOUNTING_ADDRESS  = (process.env.NEXT_PUBLIC_REWARD_ACCOUNTING_ADDRESS  ?? '') as `0x${string}`
export const BOARD_REGISTRY_ADDRESS     = (process.env.NEXT_PUBLIC_BOARD_REGISTRY_ADDRESS     ?? '') as `0x${string}`
export const USDG_ADDRESS              = (process.env.NEXT_PUBLIC_USDG_ADDRESS               ?? '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168') as `0x${string}`
export const MOCK_STRATEGY_ADDRESS     = (process.env.NEXT_PUBLIC_MOCK_STRATEGY_ADDRESS      ?? '') as `0x${string}`
export const BOARD_VAULT_ADDRESS       = (process.env.NEXT_PUBLIC_BOARD_VAULT_ADDRESS        ?? '') as `0x${string}`

export const wagmiConfig = createConfig({
  chains: [robinhoodMainnet, robinhoodTestnet],
  connectors: [injected()],
  transports: {
    [robinhoodMainnet.id]: http(),
    [robinhoodTestnet.id]: http(),
  },
})
