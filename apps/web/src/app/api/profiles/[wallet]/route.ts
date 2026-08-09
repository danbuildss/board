export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet: raw } = await params;
  const wallet = raw.toLowerCase();

  const [seatsRes, statsRes] = await Promise.all([
    pool.query(
      `SELECT seat_id, status, price, prepaid_balance, last_settled_at
       FROM seats
       WHERE board_id = 'hood' AND LOWER(owner) = $1`,
      [wallet]
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'SeatAcquired')  AS seats_taken,
         COUNT(*) FILTER (WHERE event_type = 'SeatTaken')     AS takeovers_initiated,
         COUNT(*) FILTER (WHERE event_type = 'SeatForeclosed' AND LOWER(previous_owner) = $1) AS seats_foreclosed
       FROM seat_events
       WHERE board_id = 'hood' AND (LOWER(actor) = $1 OR LOWER(previous_owner) = $1)`,
      [wallet]
    ),
  ]);

  return NextResponse.json({
    wallet,
    seatsHeld: seatsRes.rows.length,
    stats: statsRes.rows[0],
    seats: seatsRes.rows,
  });
}
