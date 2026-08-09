import { parseAbiItem, decodeEventLog, type Log } from 'viem';
import { publicClient } from './chain.js';
import { BOARD_ABI } from './abi.js';
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

// All event signatures for getLogs filter
const EVENT_NAMES = [
  'SeatAcquired', 'SeatPriceChanged', 'SeatTaken',
  'SeatToppedUp', 'HoldingFeesSettled', 'SeatForeclosed',
] as const;

async function processLog(log: Log): Promise<void> {
  // Decode the log against our ABI
  let decoded: ReturnType<typeof decodeEventLog>;
  try {
    decoded = decodeEventLog({ abi: BOARD_ABI, data: log.data, topics: log.topics });
  } catch {
    return; // Unknown event — skip
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

async function fetchBatch(fromBlock: bigint, toBlock: bigint): Promise<Log[]> {
  return publicClient.getLogs({
    address: config.boardAddress,
    fromBlock,
    toBlock,
  });
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

    const logs = await withRetry(
      () => fetchBatch(fromBlock, toBlock),
      `getLogs(${fromBlock}-${toBlock})`
    );

    if (logs.length > 0) {
      console.log(`[indexer] Block ${fromBlock}–${toBlock}: ${logs.length} event(s)`);
      for (const log of logs) {
        await processLog(log);
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
