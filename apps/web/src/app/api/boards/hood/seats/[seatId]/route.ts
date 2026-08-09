export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { deriveStatus, effectiveBalance, weeklyHoldingCost, estimatedDepletionAt } from '@/lib/status';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seatId: string }> }
) {
  const { seatId: seatIdStr } = await params;
  const seatId = parseInt(seatIdStr, 10);

  if (isNaN(seatId) || seatId < 1 || seatId > 100) {
    return NextResponse.json({ error: 'Invalid seat ID' }, { status: 400 });
  }

  const [seatRes, eventsRes] = await Promise.all([
    pool.query(
      `SELECT seat_id, owner, price, prepaid_balance, last_settled_at,
              status, estimated_depletion_at, grace_ends_at, updated_block
       FROM seats WHERE board_id = 'hood' AND seat_id = $1`,
      [seatId]
    ),
    pool.query(
      `SELECT event_type, tx_hash, block_number, block_timestamp,
              actor, previous_owner, new_owner, amount,
              previous_price, new_price, metadata, occurred_at
       FROM seat_events
       WHERE board_id = 'hood' AND seat_id = $1
       ORDER BY block_number ASC, log_index ASC`,
      [seatId]
    ),
  ]);

  if (!seatRes.rows[0]) {
    return NextResponse.json({ error: 'Seat not found' }, { status: 404 });
  }

  const row    = seatRes.rows[0];
  const status = deriveStatus(row);
  const effBal = effectiveBalance(row);
  const weekly = weeklyHoldingCost(row.price);
  const depAt  = estimatedDepletionAt(row);

  return NextResponse.json({
    seatId:               row.seat_id,
    status,
    owner:                row.owner ?? null,
    price:                row.price ?? null,
    effectiveBalance:     effBal.toString(),
    weeklyHoldingCost:    weekly.toString(),
    estimatedDepletionAt: depAt?.toISOString() ?? null,
    graceEndsAt:          depAt ? new Date(depAt.getTime() + 259200_000).toISOString() : null,
    updatedBlock:         row.updated_block ?? null,
    history:              eventsRes.rows,
  });
}
