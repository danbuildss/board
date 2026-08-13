export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const [totalRes, recentRes] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)            AS total_deposited,
         MAX(global_index)                    AS current_global_index,
         (SELECT active_seat_count FROM reward_deposits
          WHERE board_id = $1 ORDER BY block_number DESC LIMIT 1) AS active_seat_count,
         COUNT(*)                             AS deposit_count
       FROM reward_deposits WHERE board_id = $1`,
      [boardId]
    ),
    pool.query(
      `SELECT amount, global_index, active_seat_count, block_number, occurred_at
       FROM reward_deposits
       WHERE board_id = $1
       ORDER BY block_number DESC
       LIMIT 20`,
      [boardId]
    ),
  ]);

  const t = totalRes.rows[0];

  return NextResponse.json({
    boardId,
    totalDeposited:      t.total_deposited ?? '0',
    currentGlobalIndex:  t.current_global_index ?? '0',
    activeSeatCount:     t.active_seat_count ?? 0,
    depositCount:        parseInt(t.deposit_count ?? '0'),
    recentDeposits:      recentRes.rows,
  });
}
