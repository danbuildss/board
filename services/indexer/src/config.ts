function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const config = {
  rpcUrl:          process.env.RPC_URL          ?? 'https://rpc.testnet.chain.robinhood.com',
  boardAddress:    (process.env.BOARD_ADDRESS   ?? '0x0a3932a24dCC9Bbd7BFC448Da99265EC58F806DB') as `0x${string}`,
  deploymentBlock: BigInt(process.env.DEPLOYMENT_BLOCK ?? '98751649'),
  databaseUrl:     required('DATABASE_URL'),
  batchSize:       BigInt(process.env.BATCH_SIZE       ?? '500'),
  pollIntervalMs:  parseInt(process.env.POLL_INTERVAL_MS ?? '5000'),
  boardId:         'hood',
} as const;
