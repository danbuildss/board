export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  const [holdersRes, takeoversRes] = await Promise.all([
    // Top seat holders by count
    pool.query(`
      SELECT owner, COUNT(*) AS seats_held
      FROM seats
      WHERE board_id = 'hood' AND owner IS NOT NULL
      GROUP BY owner
      ORDER BY seats_held DESC
      LIMIT 20
    `),
    // Top takeover initiators
    pool.query(`
      SELECT actor AS wallet, COUNT(*) AS takeovers
      FROM seat_events
      WHERE board_id = 'hood' AND event_type = 'SeatTaken'
      GROUP BY actor
      ORDER BY takeovers DESC
      LIMIT 20
    `),
  ]);

  return NextResponse.json({
    topHolders:    holdersRes.rows,
    topTakeovers:  takeoversRes.rows,
  });
}
