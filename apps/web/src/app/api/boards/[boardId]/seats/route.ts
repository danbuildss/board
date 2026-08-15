export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { deriveStatus, effectiveBalance, weeklyHoldingCost, estimatedDepletionAt } from '@/lib/status';
import { resolveBoard } from '@/lib/board-resolver';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const boardId = resolveBoard((await params).boardId);
  const lite = req.nextUrl.searchParams.get('lite') === '1';

  const res = await pool.query(
    `SELECT seat_id, owner, price, prepaid_balance, last_settled_at,
            status, estimated_depletion_at, grace_ends_at, updated_block
     FROM seats
     WHERE board_id = $1
     ORDER BY seat_id ASC`,
    [boardId]
  );

  const seats = res.rows.map(row => {
    const status = deriveStatus(row);
    if (lite) return { seatId: row.seat_id, status };

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

  return NextResponse.json({ seats }, {
    headers: { 'Cache-Control': 's-maxage=15, stale-while-revalidate=30' },
  });
}
