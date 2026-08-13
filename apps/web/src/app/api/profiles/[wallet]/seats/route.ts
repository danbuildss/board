export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { deriveStatus, effectiveBalance, weeklyHoldingCost, estimatedDepletionAt } from '@/lib/status';

const BOARD_ID = process.env.BOARD_ID ?? 'hood';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet: raw } = await params;
  const wallet = raw.toLowerCase();

  const res = await pool.query(
    `SELECT seat_id, owner, price, prepaid_balance, last_settled_at,
            status, updated_block
     FROM seats
     WHERE board_id = $2 AND LOWER(owner) = $1
     ORDER BY seat_id ASC`,
    [wallet, BOARD_ID]
  );

  const seats = res.rows.map(row => {
    const status = deriveStatus(row);
    const effBal = effectiveBalance(row);
    const weekly = weeklyHoldingCost(row.price);
    const depAt  = estimatedDepletionAt(row);
    return {
      seatId:               row.seat_id,
      status,
      price:                row.price,
      effectiveBalance:     effBal.toString(),
      weeklyHoldingCost:    weekly.toString(),
      estimatedDepletionAt: depAt?.toISOString() ?? null,
      graceEndsAt:          depAt ? new Date(depAt.getTime() + 259200_000).toISOString() : null,
    };
  });

  return NextResponse.json({ wallet, seats });
}
