import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { deriveStatus, effectiveBalance, weeklyHoldingCost, estimatedDepletionAt } from '@/lib/status';

export async function GET() {
  const res = await pool.query(`
    SELECT seat_id, owner, price, prepaid_balance, last_settled_at,
           status, estimated_depletion_at, grace_ends_at, updated_block
    FROM seats
    WHERE board_id = 'hood'
    ORDER BY seat_id ASC
  `);

  const seats = res.rows.map(row => {
    const status = deriveStatus(row);
    const effBal = effectiveBalance(row);
    const weekly = weeklyHoldingCost(row.price);
    const depAt  = estimatedDepletionAt(row);

    return {
      seatId:               row.seat_id,
      status,
      owner:                row.owner ?? null,
      price:                row.price ?? null,
      effectiveBalance:     effBal.toString(),
      weeklyHoldingCost:    weekly.toString(),
      estimatedDepletionAt: depAt?.toISOString() ?? null,
      graceEndsAt:          depAt ? new Date(depAt.getTime() + 259200_000).toISOString() : null,
      updatedBlock:         row.updated_block ?? null,
    };
  });

  return NextResponse.json({ seats });
}
