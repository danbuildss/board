import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function migrate(): Promise<void> {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const schema = readFileSync(join(__dir, '../../schema.sql'), 'utf8');
  await pool.query(schema);
}

export async function getLastIndexedBlock(): Promise<bigint> {
  const res = await pool.query<{ last_indexed_block: string }>(
    `SELECT last_indexed_block FROM indexer_state WHERE id = 'singleton'`
  );
  if (res.rows.length === 0) return config.deploymentBlock - 1n;
  return BigInt(res.rows[0].last_indexed_block);
}

export async function saveLastIndexedBlock(block: bigint): Promise<void> {
  await pool.query(
    `INSERT INTO indexer_state (id, last_indexed_block, updated_at)
     VALUES ('singleton', $1, NOW())
     ON CONFLICT (id) DO UPDATE SET last_indexed_block = $1, updated_at = NOW()`,
    [block.toString()]
  );
}

export async function resetForRebuild(): Promise<void> {
  await pool.query(
    'TRUNCATE seat_events, seats, reward_deposits, seat_reward_state, reward_claims RESTART IDENTITY CASCADE'
  );
  await pool.query(`DELETE FROM indexer_state`);
  console.log('[db] Cleared seat_events, seats, reward tables, indexer_state for rebuild');
}

export async function ensureBoard(): Promise<void> {
  await pool.query(
    `INSERT INTO boards (id, name, chain_id, contract_address, seat_count, deployment_block, settlement_asset)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [config.boardId, config.boardName, config.chainId, config.boardAddress,
     config.seatCount, config.deploymentBlock.toString(), config.settlementAsset]
  );

  // Pre-populate all 100 seats as VACANT if not already present
  const inserts = Array.from({ length: config.seatCount }, (_, i) => i + 1)
    .map((_, i) => `($1, ${i + 1}, 'VACANT')`)
    .join(', ');
  await pool.query(
    `INSERT INTO seats (board_id, seat_id, status) VALUES ${inserts} ON CONFLICT DO NOTHING`,
    [config.boardId]
  );
}
