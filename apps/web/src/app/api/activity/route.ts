export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const BOARD_ID = process.env.BOARD_ID ?? 'hood';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const res = await pool.query(
    `SELECT e.event_type, e.seat_id, e.tx_hash, e.block_number,
            e.block_timestamp, e.actor, e.previous_owner, e.new_owner,
            e.amount, e.previous_price, e.new_price, e.metadata, e.occurred_at
     FROM seat_events e
     WHERE e.board_id = $3
       AND e.event_type NOT IN ('HoldingFeesSettled', 'EarningsBanked')
     ORDER BY e.block_number DESC, e.log_index DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset, BOARD_ID]
  );

  return NextResponse.json({ activity: res.rows, limit, offset });
}
