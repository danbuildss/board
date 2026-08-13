import { type Log } from 'viem';
import { pool } from './db.js';
import { config } from './config.js';

function toDate(ts: bigint): Date {
  return new Date(Number(ts) * 1000);
}

// ─── RewardDeposited ─────────────────────────────────────────────────────────

export async function handleRewardDeposited(log: Log, args: {
  amount: bigint; newGlobalIndex: bigint; activeSeatCount: bigint;
  blockTimestamp: bigint;
}): Promise<void> {
  await pool.query(
    `INSERT INTO reward_deposits
       (board_id, amount, global_index, active_seat_count,
        tx_hash, log_index, block_number, block_timestamp, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tx_hash, log_index) DO NOTHING`,
    [
      config.boardId,
      args.amount.toString(),
      args.newGlobalIndex.toString(),
      Number(args.activeSeatCount),
      log.transactionHash!,
      log.logIndex!,
      log.blockNumber!.toString(),
      toDate(args.blockTimestamp),
      toDate(args.blockTimestamp),
    ]
  );
}

// ─── EarningsBanked ──────────────────────────────────────────────────────────

export async function handleEarningsBanked(log: Log, args: {
  seatId: bigint; owner: `0x${string}`; amount: bigint; blockTimestamp: bigint;
}): Promise<void> {
  const seatId = Number(args.seatId);

  // Upsert seat_reward_state — accumulate cumulative_banked
  await pool.query(
    `INSERT INTO seat_reward_state (board_id, seat_id, cumulative_banked, last_updated_block, last_updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (board_id, seat_id) DO UPDATE
       SET cumulative_banked  = seat_reward_state.cumulative_banked + EXCLUDED.cumulative_banked,
           last_updated_block = EXCLUDED.last_updated_block,
           last_updated_at    = NOW()`,
    [config.boardId, seatId, args.amount.toString(), log.blockNumber!.toString()]
  );
}

// ─── RewardClaimed ───────────────────────────────────────────────────────────

export async function handleRewardClaimed(log: Log, args: {
  owner: `0x${string}`; amount: bigint; blockTimestamp: bigint;
}): Promise<void> {
  await pool.query(
    `INSERT INTO reward_claims
       (board_id, owner, amount, tx_hash, log_index, block_number, block_timestamp, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tx_hash, log_index) DO NOTHING`,
    [
      config.boardId,
      args.owner.toLowerCase(),
      args.amount.toString(),
      log.transactionHash!,
      log.logIndex!,
      log.blockNumber!.toString(),
      toDate(args.blockTimestamp),
      toDate(args.blockTimestamp),
    ]
  );
}
