export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const BOARD_ID = process.env.BOARD_ID ?? 'hood';

export async function GET() {
  const [holdersRes, takeoversRes] = await Promise.all([
    pool.query(
      `SELECT owner, COUNT(*) AS seats_held
       FROM seats
       WHERE board_id = $1 AND owner IS NOT NULL
       GROUP BY owner
       ORDER BY seats_held DESC
       LIMIT 20`,
      [BOARD_ID]
    ),
    pool.query(
      `SELECT actor AS wallet, COUNT(*) AS takeovers
       FROM seat_events
       WHERE board_id = $1 AND event_type = 'SeatTaken'
       GROUP BY actor
       ORDER BY takeovers DESC
       LIMIT 20`,
      [BOARD_ID]
    ),
  ]);

  return NextResponse.json({
    topHolders:    holdersRes.rows,
    topTakeovers:  takeoversRes.rows,
  });
}
