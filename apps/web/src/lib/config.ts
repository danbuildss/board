import { createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { defineChain } from 'viem'

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

export const BOARD_ADDRESS         = '0x0a3932a24dCC9Bbd7BFC448Da99265EC58F806DB' as const
export const USDG_ADDRESS          = '0x7E955252E15c84f5768B83c41a71F9eba181802F' as const
export const MOCK_STRATEGY_ADDRESS = '0xcc061Ecc90ddF9785b20bD99A604dA27CF784911' as const
export const BOARD_VAULT_ADDRESS   = '0xf3751c59f4D90B3F117560Fc61c7968D8e1C4648' as const
export const CHAIN_ID              = 46630

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  transports: { [robinhoodTestnet.id]: http() },
})
