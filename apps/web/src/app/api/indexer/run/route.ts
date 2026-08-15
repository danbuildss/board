export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, defineChain, decodeEventLog, decodeFunctionData, type Log } from 'viem';
import { pool } from '@/lib/db';

// ─── Auth ────────────────────────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const secret = process.env.INDEXER_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

// ─── Chain + ABI ─────────────────────────────────────────────────────────────

const chain = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? 'https://rpc.testnet.chain.robinhood.com'] } },
});

const client = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });

const BOARD_ADDRESS = (process.env.NEXT_PUBLIC_BOARD_ADDRESS ?? '0x6A57Ff5C1d105941c8A6CcCC681F37B1FED9733E') as `0x${string}`;
const DEPLOYMENT_BLOCK = BigInt(process.env.DEPLOYMENT_BLOCK ?? '98751649');
const BATCH_SIZE = 200n;
const BOARD_ID = process.env.BOARD_ID ?? 'hood';

const ABI = [
  { type: 'event', name: 'SeatAcquired', inputs: [
    { name: 'seatId', type: 'uint256', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'initialPrice', type: 'uint256', indexed: false },
    { name: 'initialHoldingDeposit', type: 'uint256', indexed: false },
    { name: 'timestamp', type: 'uint256', indexed: false },
  ]},
  { type: 'event', name: 'SeatPriceChanged', inputs: [
    { name: 'seatId', type: 'uint256', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'previousPrice', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
    { name: 'timestamp', type: 'uint256', indexed: false },
  ]},
  { type: 'event', name: 'SeatTaken', inputs: [
    { name: 'seatId', type: 'uint256', indexed: true },
    { name: 'previousOwner', type: 'address', indexed: true },
    { name: 'newOwner', type: 'address', indexed: true },
    { name: 'takeoverPrice', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
    { name: 'remainingBalanceRefund', type: 'uint256', indexed: false },
    { name: 'protocolFee', type: 'uint256', indexed: false },
    { name: 'timestamp', type: 'uint256', indexed: false },
  ]},
  { type: 'event', name: 'SeatToppedUp', inputs: [
    { name: 'seatId', type: 'uint256', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'newPrepaidBalance', type: 'uint256', indexed: false },
    { name: 'timestamp', type: 'uint256', indexed: false },
  ]},
  { type: 'event', name: 'HoldingFeesSettled', inputs: [
    { name: 'seatId', type: 'uint256', indexed: true },
    { name: 'fee', type: 'uint256', indexed: false },
    { name: 'elapsed', type: 'uint256', indexed: false },
    { name: 'remainingBalance', type: 'uint256', indexed: false },
    { name: 'timestamp', type: 'uint256', indexed: false },
  ]},
  { type: 'event', name: 'SeatForeclosed', inputs: [
    { name: 'seatId', type: 'uint256', indexed: true },
    { name: 'previousOwner', type: 'address', indexed: true },
    { name: 'timestamp', type: 'uint256', indexed: false },
  ]},
  { type: 'function', name: 'takeSeat', inputs: [
    { name: 'seatId', type: 'uint256' },
    { name: 'expectedOwner', type: 'address' },
    { name: 'expectedPrice', type: 'uint256' },
    { name: 'newPrice', type: 'uint256' },
    { name: 'prepaidDeposit', type: 'uint256' },
  ], outputs: [], stateMutability: 'nonpayable' },
] as const;

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function getCursor(): Promise<bigint> {
  const res = await pool.query(`SELECT last_indexed_block FROM indexer_state WHERE id = 'singleton'`);
  return res.rows[0] ? BigInt(res.rows[0].last_indexed_block) : DEPLOYMENT_BLOCK - 1n;
}

async function saveCursor(block: bigint): Promise<void> {
  await pool.query(
    `INSERT INTO indexer_state (id, last_indexed_block, updated_at) VALUES ('singleton',$1,NOW())
     ON CONFLICT (id) DO UPDATE SET last_indexed_block=$1, updated_at=NOW()`,
    [block.toString()]
  );
}

function toDate(ts: bigint): Date { return new Date(Number(ts) * 1000); }

async function upsertEvent(p: {
  seatId: number; eventType: string; txHash: string; logIndex: number;
  blockNumber: bigint; blockTimestamp: bigint; actor?: string;
  previousOwner?: string; newOwner?: string; amount?: bigint;
  previousPrice?: bigint; newPrice?: bigint; metadata?: object;
}): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO seat_events
       (board_id,seat_id,event_type,tx_hash,log_index,block_number,block_timestamp,
        actor,previous_owner,new_owner,amount,previous_price,new_price,metadata,occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (tx_hash,log_index) DO NOTHING`,
    [BOARD_ID, p.seatId, p.eventType, p.txHash, p.logIndex, p.blockNumber.toString(),
     toDate(p.blockTimestamp), p.actor??null, p.previousOwner??null, p.newOwner??null,
     p.amount?.toString()??null, p.previousPrice?.toString()??null, p.newPrice?.toString()??null,
     p.metadata ? JSON.stringify(p.metadata) : null, toDate(p.blockTimestamp)]
  );
  return (res.rowCount ?? 0) > 0;
}

async function patchSeat(seatId: number, blockNumber: bigint, patch: {
  owner?: string|null; price?: bigint; prepaidBalance?: bigint;
  lastSettledAt?: bigint; status?: string; clear?: boolean;
}): Promise<void> {
  if (patch.clear) {
    await pool.query(
      `UPDATE seats SET owner=NULL,price=NULL,prepaid_balance=NULL,last_settled_at=NULL,
       status='VACANT',estimated_depletion_at=NULL,grace_ends_at=NULL,
       updated_block=$3,updated_at=NOW() WHERE board_id=$1 AND seat_id=$2`,
      [BOARD_ID, seatId, blockNumber.toString()]
    );
    return;
  }

  const sets: string[] = ['updated_block=$3', 'updated_at=NOW()'];
  const vals: unknown[] = [BOARD_ID, seatId, blockNumber.toString()];
  let idx = 4;

  if (patch.owner !== undefined) { sets.push(`owner=$${idx++}`); vals.push(patch.owner); }
  if (patch.price !== undefined) { sets.push(`price=$${idx++}`); vals.push(patch.price.toString()); }
  if (patch.prepaidBalance !== undefined) { sets.push(`prepaid_balance=$${idx++}`); vals.push(patch.prepaidBalance.toString()); }
  if (patch.lastSettledAt !== undefined) { sets.push(`last_settled_at=$${idx++}`); vals.push(toDate(patch.lastSettledAt)); }
  if (patch.status !== undefined) { sets.push(`status=$${idx++}`); vals.push(patch.status); }

  await pool.query(
    `UPDATE seats SET ${sets.join(',')} WHERE board_id=$1 AND seat_id=$2`,
    vals
  );
}

// ─── Log processor ───────────────────────────────────────────────────────────

async function processLog(log: Log): Promise<void> {
  let decoded: ReturnType<typeof decodeEventLog>;
  try { decoded = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics }); }
  catch { return; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = decoded.args as any;
  const seatId = Number(a.seatId);
  const bn = log.blockNumber!;
  const txHash = log.transactionHash!;
  const li = log.logIndex!;

  switch (decoded.eventName) {
    case 'SeatAcquired': {
      const ok = await upsertEvent({ seatId, eventType: 'SeatAcquired', txHash, logIndex: li, blockNumber: bn, blockTimestamp: a.timestamp, actor: a.owner, newOwner: a.owner, amount: a.initialHoldingDeposit, newPrice: a.initialPrice });
      if (ok) await patchSeat(seatId, bn, { owner: a.owner, price: a.initialPrice, prepaidBalance: a.initialHoldingDeposit, lastSettledAt: a.timestamp, status: 'ACTIVE' });
      break;
    }
    case 'SeatPriceChanged': {
      const ok = await upsertEvent({ seatId, eventType: 'SeatPriceChanged', txHash, logIndex: li, blockNumber: bn, blockTimestamp: a.timestamp, actor: a.owner, previousPrice: a.previousPrice, newPrice: a.newPrice });
      if (ok) await patchSeat(seatId, bn, { price: a.newPrice });
      break;
    }
    case 'SeatTaken': {
      let prepaidDeposit: bigint | undefined;
      try {
        const tx = await client.getTransaction({ hash: txHash });
        const d = decodeFunctionData({ abi: ABI, data: tx.input });
        if (d.functionName === 'takeSeat') prepaidDeposit = (d.args as unknown as unknown[])[4] as bigint;
      } catch {}
      const ok = await upsertEvent({ seatId, eventType: 'SeatTaken', txHash, logIndex: li, blockNumber: bn, blockTimestamp: a.timestamp, actor: a.newOwner, previousOwner: a.previousOwner, newOwner: a.newOwner, amount: a.takeoverPrice, previousPrice: a.takeoverPrice, newPrice: a.newPrice, metadata: { remainingBalanceRefund: a.remainingBalanceRefund.toString(), protocolFee: a.protocolFee.toString(), prepaidDeposit: prepaidDeposit?.toString() ?? null } });
      if (ok) await patchSeat(seatId, bn, { owner: a.newOwner, price: a.newPrice, prepaidBalance: prepaidDeposit, lastSettledAt: a.timestamp, status: 'ACTIVE' });
      break;
    }
    case 'SeatToppedUp': {
      const ok = await upsertEvent({ seatId, eventType: 'SeatToppedUp', txHash, logIndex: li, blockNumber: bn, blockTimestamp: a.timestamp, actor: a.owner, amount: a.amount });
      if (ok) await patchSeat(seatId, bn, { prepaidBalance: a.newPrepaidBalance, lastSettledAt: a.timestamp, status: 'ACTIVE' });
      break;
    }
    case 'HoldingFeesSettled': {
      const ok = await upsertEvent({ seatId, eventType: 'HoldingFeesSettled', txHash, logIndex: li, blockNumber: bn, blockTimestamp: a.timestamp, amount: a.fee, metadata: { elapsed: a.elapsed.toString(), remainingBalance: a.remainingBalance.toString() } });
      if (ok) await patchSeat(seatId, bn, { prepaidBalance: a.remainingBalance, lastSettledAt: a.timestamp });
      break;
    }
    case 'SeatForeclosed': {
      const ok = await upsertEvent({ seatId, eventType: 'SeatForeclosed', txHash, logIndex: li, blockNumber: bn, blockTimestamp: a.timestamp, actor: a.previousOwner, previousOwner: a.previousOwner });
      if (ok) await patchSeat(seatId, bn, { clear: true });
      break;
    }
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deadline = Date.now() + 45_000; // 45s budget (Vercel Pro = 60s max)
  let eventsProcessed = 0;
  let blocksProcessed = 0;

  const fromBlock = (await getCursor()) + 1n;
  const latestBlock = await client.getBlockNumber();

  if (fromBlock > latestBlock) {
    return NextResponse.json({ status: 'up_to_date', latestBlock: latestBlock.toString() });
  }

  let cursor = fromBlock;

  while (cursor <= latestBlock && Date.now() < deadline) {
    const toBlock = cursor + BATCH_SIZE - 1n < latestBlock
      ? cursor + BATCH_SIZE - 1n
      : latestBlock;

    const logs = await client.getLogs({ address: BOARD_ADDRESS, fromBlock: cursor, toBlock });

    for (const log of logs) {
      await processLog(log);
      eventsProcessed++;
    }

    await saveCursor(toBlock);
    blocksProcessed += Number(toBlock - cursor + 1n);
    cursor = toBlock + 1n;
  }

  return NextResponse.json({
    status:          cursor > latestBlock ? 'up_to_date' : 'partial',
    fromBlock:       fromBlock.toString(),
    indexedUpTo:     (cursor - 1n).toString(),
    latestBlock:     latestBlock.toString(),
    blocksProcessed,
    eventsProcessed,
  });
}
