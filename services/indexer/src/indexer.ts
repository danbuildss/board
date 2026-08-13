import { decodeEventLog, type Log } from 'viem';
import { publicClient } from './chain.js';
import { BOARD_ABI, REWARD_ACCOUNTING_ABI } from './abi.js';
import { config } from './config.js';
import { getLastIndexedBlock, saveLastIndexedBlock } from './db.js';
import {
  handleSeatAcquired,
  handleSeatPriceChanged,
  handleSeatTaken,
  handleSeatToppedUp,
  handleHoldingFeesSettled,
  handleSeatForeclosed,
} from './handlers.js';
import {
  handleRewardDeposited,
  handleEarningsBanked,
  handleRewardClaimed,
} from './reward-handlers.js';

async function processBoardLog(log: Log): Promise<void> {
  let decoded: ReturnType<typeof decodeEventLog>;
  try {
    decoded = decodeEventLog({ abi: BOARD_ABI, data: log.data, topics: log.topics });
  } catch {
    return;
  }

  const args = decoded.args as Record<string, unknown>;

  switch (decoded.eventName) {
    case 'SeatAcquired':
      await handleSeatAcquired(log, args as Parameters<typeof handleSeatAcquired>[1]);
      break;
    case 'SeatPriceChanged':
      await handleSeatPriceChanged(log, args as Parameters<typeof handleSeatPriceChanged>[1]);
      break;
    case 'SeatTaken':
      await handleSeatTaken(log, args as Parameters<typeof handleSeatTaken>[1]);
      break;
    case 'SeatToppedUp':
      await handleSeatToppedUp(log, args as Parameters<typeof handleSeatToppedUp>[1]);
      break;
    case 'HoldingFeesSettled':
      await handleHoldingFeesSettled(log, args as Parameters<typeof handleHoldingFeesSettled>[1]);
      break;
    case 'SeatForeclosed':
      await handleSeatForeclosed(log, args as Parameters<typeof handleSeatForeclosed>[1]);
      break;
  }
}

async function processRewardLog(log: Log): Promise<void> {
  let decoded: ReturnType<typeof decodeEventLog>;
  try {
    decoded = decodeEventLog({ abi: REWARD_ACCOUNTING_ABI, data: log.data, topics: log.topics });
  } catch {
    return;
  }

  const args = decoded.args as Record<string, unknown>;

  // Block timestamp is not in reward events — fetch the block to get it
  let blockTimestamp = 0n;
  try {
    const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
    blockTimestamp = block.timestamp;
  } catch {
    // Non-fatal: blockTimestamp will be 0 and stored as epoch
  }

  switch (decoded.eventName) {
    case 'RewardDeposited':
      await handleRewardDeposited(log, {
        ...(args as Parameters<typeof handleRewardDeposited>[1]),
        blockTimestamp,
      });
      break;
    case 'EarningsBanked':
      await handleEarningsBanked(log, {
        ...(args as Parameters<typeof handleEarningsBanked>[1]),
        blockTimestamp,
      });
      break;
    case 'RewardClaimed':
      await handleRewardClaimed(log, {
        ...(args as Parameters<typeof handleRewardClaimed>[1]),
        blockTimestamp,
      });
      break;
  }
}

async function fetchBatch(fromBlock: bigint, toBlock: bigint): Promise<{ boardLogs: Log[]; rewardLogs: Log[] }> {
  const addresses: `0x${string}`[] = [config.boardAddress];
  if (config.rewardAccountingAddress) {
    addresses.push(config.rewardAccountingAddress);
  }

  const allLogs = await publicClient.getLogs({ address: addresses, fromBlock, toBlock });

  const boardLogs: Log[] = [];
  const rewardLogs: Log[] = [];
  const raAddr = config.rewardAccountingAddress?.toLowerCase();

  for (const log of allLogs) {
    if (raAddr && log.address.toLowerCase() === raAddr) {
      rewardLogs.push(log);
    } else {
      boardLogs.push(log);
    }
  }

  return { boardLogs, rewardLogs };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> {
  let delay = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`[indexer] ${label} failed (attempt ${attempt}/${maxAttempts}): ${err}`);
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error('unreachable');
}

export async function runIndexer(): Promise<void> {
  let fromBlock = (await getLastIndexedBlock()) + 1n;
  console.log(`[indexer] Starting from block ${fromBlock}`);

  while (true) {
    const latestBlock = await withRetry(
      () => publicClient.getBlockNumber(),
      'getBlockNumber'
    );

    if (fromBlock > latestBlock) {
      await sleep(config.pollIntervalMs);
      continue;
    }

    const toBlock = fromBlock + config.batchSize - 1n < latestBlock
      ? fromBlock + config.batchSize - 1n
      : latestBlock;

    const { boardLogs, rewardLogs } = await withRetry(
      () => fetchBatch(fromBlock, toBlock),
      `getLogs(${fromBlock}-${toBlock})`
    );

    const total = boardLogs.length + rewardLogs.length;
    if (total > 0) {
      console.log(`[indexer] Block ${fromBlock}–${toBlock}: ${boardLogs.length} board / ${rewardLogs.length} reward event(s)`);
      for (const log of boardLogs) {
        await processBoardLog(log);
      }
      for (const log of rewardLogs) {
        await processRewardLog(log);
      }
    }

    await saveLastIndexedBlock(toBlock);
    fromBlock = toBlock + 1n;

    // If we caught up, wait before polling again
    if (toBlock === latestBlock) {
      await sleep(config.pollIntervalMs);
    }
  }
}
