function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const config = {
  rpcUrl:           process.env.RPC_URL          ?? 'https://rpc.testnet.chain.robinhood.com',
  boardAddress:     (process.env.BOARD_ADDRESS   ?? '0x0a3932a24dCC9Bbd7BFC448Da99265EC58F806DB') as `0x${string}`,
  deploymentBlock:  BigInt(process.env.DEPLOYMENT_BLOCK ?? '98751649'),
  databaseUrl:      required('DATABASE_URL'),
  batchSize:        BigInt(process.env.BATCH_SIZE       ?? '500'),
  pollIntervalMs:   parseInt(process.env.POLL_INTERVAL_MS ?? '5000'),
  boardId:          process.env.BOARD_ID          ?? 'hood',
  boardName:        process.env.BOARD_NAME        ?? 'HOOD Board',
  chainId:          parseInt(process.env.CHAIN_ID  ?? '46630'),
  seatCount:        parseInt(process.env.SEAT_COUNT ?? '100'),
  settlementAsset:  process.env.SETTLEMENT_ASSET  ?? '0x7E955252E15c84f5768B83c41a71F9eba181802F',
} as const;
