import { decodeFunctionData, type Log } from 'viem';
import { pool } from './db.js';
import { publicClient } from './chain.js';
import { BOARD_ABI } from './abi.js';
import { config } from './config.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HOLDING_RATE_NUM = 5n;
const HOLDING_RATE_DEN = 1000n;
const HOLDING_PERIOD   = 604800n; // seconds in 7 days
const GRACE_PERIOD     = 259200n; // 72 hours

function depletionTs(price: bigint, prepaid: bigint, lastSettledAt: bigint): bigint | null {
  if (price === 0n) return null;
  return lastSettledAt + (prepaid * HOLDING_RATE_DEN * HOLDING_PERIOD) / (price * HOLDING_RATE_NUM);
}

function toDate(ts: bigint): Date {
  return new Date(Number(ts) * 1000);
}

async function insertEvent(params: {
  seatId: number;
  eventType: string;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp: bigint;
  actor?: string;
  previousOwner?: string;
  newOwner?: string;
  amount?: bigint;
  previousPrice?: bigint;
  newPrice?: bigint;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO seat_events
       (board_id, seat_id, event_type, tx_hash, log_index, block_number,
        block_timestamp, actor, previous_owner, new_owner, amount,
        previous_price, new_price, metadata, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (tx_hash, log_index) DO NOTHING`,
    [
      config.boardId,
      params.seatId,
      params.eventType,
      params.txHash,
      params.logIndex,
      params.blockNumber.toString(),
      toDate(params.blockTimestamp),
      params.actor ?? null,
      params.previousOwner ?? null,
      params.newOwner ?? null,
      params.amount?.toString() ?? null,
      params.previousPrice?.toString() ?? null,
      params.newPrice?.toString() ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      toDate(params.blockTimestamp),
    ]
  );
  return (res.rowCount ?? 0) > 0; // false = duplicate, already processed
}

async function updateSeat(params: {
  seatId: number;
  blockNumber: bigint;
  patch: {
    owner?: string | null;
    price?: bigint | null;
    prepaidBalance?: bigint | null;
    lastSettledAt?: bigint | null;
    status?: string;
  };
}): Promise<void> {
  const { patch } = params;

  // Compute depletion + grace if we have enough info
  let depletionAt: Date | null = null;
  let graceEndsAt: Date | null = null;

  if (patch.price != null && patch.prepaidBalance != null && patch.lastSettledAt != null) {
    const dep = depletionTs(patch.price, patch.prepaidBalance, patch.lastSettledAt);
    if (dep !== null) {
      depletionAt = toDate(dep);
      graceEndsAt = toDate(dep + GRACE_PERIOD);
    }
  }

  await pool.query(
    `UPDATE seats SET
       owner                  = COALESCE($3, owner),
       price                  = COALESCE($4, price),
       prepaid_balance        = COALESCE($5, prepaid_balance),
       last_settled_at        = COALESCE($6, last_settled_at),
       status                 = COALESCE($7, status),
       estimated_depletion_at = COALESCE($8, estimated_depletion_at),
       grace_ends_at          = COALESCE($9, grace_ends_at),
       updated_block          = $10,
       updated_at             = NOW()
     WHERE board_id = $1 AND seat_id = $2`,
    [
      config.boardId,
      params.seatId,
      patch.owner !== undefined ? patch.owner : undefined,
      patch.price?.toString() ?? undefined,
      patch.prepaidBalance?.toString() ?? undefined,
      patch.lastSettledAt != null ? toDate(patch.lastSettledAt) : undefined,
      patch.status ?? undefined,
      depletionAt,
      graceEndsAt,
      params.blockNumber.toString(),
    ]
  );
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

export async function handleSeatAcquired(log: Log, args: {
  seatId: bigint; owner: `0x${string}`;
  initialPrice: bigint; initialHoldingDeposit: bigint; timestamp: bigint;
}): Promise<void> {
  const dup = await insertEvent({
    seatId: Number(args.seatId),
    eventType: 'SeatAcquired',
    txHash: log.transactionHash!,
    logIndex: log.logIndex!,
    blockNumber: log.blockNumber!,
    blockTimestamp: args.timestamp,
    actor: args.owner,
    newOwner: args.owner,
    amount: args.initialHoldingDeposit,
    newPrice: args.initialPrice,
  });
  if (!dup) return;

  await updateSeat({
    seatId: Number(args.seatId),
    blockNumber: log.blockNumber!,
    patch: {
      owner: args.owner,
      price: args.initialPrice,
      prepaidBalance: args.initialHoldingDeposit,
      lastSettledAt: args.timestamp,
      status: 'ACTIVE',
    },
  });
}

export async function handleSeatPriceChanged(log: Log, args: {
  seatId: bigint; owner: `0x${string}`;
  previousPrice: bigint; newPrice: bigint; timestamp: bigint;
}): Promise<void> {
  const dup = await insertEvent({
    seatId: Number(args.seatId),
    eventType: 'SeatPriceChanged',
    txHash: log.transactionHash!,
    logIndex: log.logIndex!,
    blockNumber: log.blockNumber!,
    blockTimestamp: args.timestamp,
    actor: args.owner,
    previousPrice: args.previousPrice,
    newPrice: args.newPrice,
  });
  if (!dup) return;

  await updateSeat({
    seatId: Number(args.seatId),
    blockNumber: log.blockNumber!,
    patch: { price: args.newPrice },
  });
}

export async function handleSeatTaken(log: Log, args: {
  seatId: bigint; previousOwner: `0x${string}`; newOwner: `0x${string}`;
  takeoverPrice: bigint; newPrice: bigint;
  remainingBalanceRefund: bigint; protocolFee: bigint; timestamp: bigint;
}): Promise<void> {
  // Decode calldata to get buyer's prepaidDeposit — not in event args
  let prepaidDeposit: bigint | null = null;
  try {
    const tx = await publicClient.getTransaction({ hash: log.transactionHash! });
    const decoded = decodeFunctionData({ abi: BOARD_ABI, data: tx.input });
    if (decoded.functionName === 'takeSeat') {
      prepaidDeposit = decoded.args[4] as bigint;
    }
  } catch (err) {
    console.warn(`[handler] Could not decode takeSeat calldata for ${log.transactionHash}: ${err}`);
  }

  const dup = await insertEvent({
    seatId: Number(args.seatId),
    eventType: 'SeatTaken',
    txHash: log.transactionHash!,
    logIndex: log.logIndex!,
    blockNumber: log.blockNumber!,
    blockTimestamp: args.timestamp,
    actor: args.newOwner,
    previousOwner: args.previousOwner,
    newOwner: args.newOwner,
    amount: args.takeoverPrice,
    previousPrice: args.takeoverPrice,
    newPrice: args.newPrice,
    metadata: {
      remainingBalanceRefund: args.remainingBalanceRefund.toString(),
      protocolFee: args.protocolFee.toString(),
      prepaidDeposit: prepaidDeposit?.toString() ?? null,
    },
  });
  if (!dup) return;

  await updateSeat({
    seatId: Number(args.seatId),
    blockNumber: log.blockNumber!,
    patch: {
      owner: args.newOwner,
      price: args.newPrice,
      prepaidBalance: prepaidDeposit ?? undefined,
      lastSettledAt: args.timestamp,
      status: 'ACTIVE',
    },
  });
}

export async function handleSeatToppedUp(log: Log, args: {
  seatId: bigint; owner: `0x${string}`;
  amount: bigint; newPrepaidBalance: bigint; timestamp: bigint;
}): Promise<void> {
  const dup = await insertEvent({
    seatId: Number(args.seatId),
    eventType: 'SeatToppedUp',
    txHash: log.transactionHash!,
    logIndex: log.logIndex!,
    blockNumber: log.blockNumber!,
    blockTimestamp: args.timestamp,
    actor: args.owner,
    amount: args.amount,
  });
  if (!dup) return;

  await updateSeat({
    seatId: Number(args.seatId),
    blockNumber: log.blockNumber!,
    patch: {
      prepaidBalance: args.newPrepaidBalance,
      lastSettledAt: args.timestamp,
      status: 'ACTIVE',
    },
  });
}

export async function handleHoldingFeesSettled(log: Log, args: {
  seatId: bigint; fee: bigint; elapsed: bigint; remainingBalance: bigint; timestamp: bigint;
}): Promise<void> {
  const dup = await insertEvent({
    seatId: Number(args.seatId),
    eventType: 'HoldingFeesSettled',
    txHash: log.transactionHash!,
    logIndex: log.logIndex!,
    blockNumber: log.blockNumber!,
    blockTimestamp: args.timestamp,
    amount: args.fee,
    metadata: {
      elapsed: args.elapsed.toString(),
      remainingBalance: args.remainingBalance.toString(),
    },
  });
  if (!dup) return;

  await updateSeat({
    seatId: Number(args.seatId),
    blockNumber: log.blockNumber!,
    patch: {
      prepaidBalance: args.remainingBalance,
      lastSettledAt: args.timestamp,
    },
  });
}

export async function handleSeatForeclosed(log: Log, args: {
  seatId: bigint; previousOwner: `0x${string}`; timestamp: bigint;
}): Promise<void> {
  const dup = await insertEvent({
    seatId: Number(args.seatId),
    eventType: 'SeatForeclosed',
    txHash: log.transactionHash!,
    logIndex: log.logIndex!,
    blockNumber: log.blockNumber!,
    blockTimestamp: args.timestamp,
    actor: args.previousOwner,
    previousOwner: args.previousOwner,
  });
  if (!dup) return;

  // Return seat to VACANT — clear all state
  await pool.query(
    `UPDATE seats SET
       owner = NULL, price = NULL, prepaid_balance = NULL,
       last_settled_at = NULL, status = 'VACANT',
       estimated_depletion_at = NULL, grace_ends_at = NULL,
       updated_block = $3, updated_at = NOW()
     WHERE board_id = $1 AND seat_id = $2`,
    [config.boardId, Number(args.seatId), log.blockNumber!.toString()]
  );
}
