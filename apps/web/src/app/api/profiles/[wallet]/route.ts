export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const BOARD_ID = process.env.BOARD_ID ?? 'hood';

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
       WHERE board_id = $2 AND LOWER(owner) = $1`,
      [wallet, BOARD_ID]
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'SeatAcquired')  AS seats_taken,
         COUNT(*) FILTER (WHERE event_type = 'SeatTaken')     AS takeovers_initiated,
         COUNT(*) FILTER (WHERE event_type = 'SeatForeclosed' AND LOWER(previous_owner) = $1) AS seats_foreclosed
       FROM seat_events
       WHERE board_id = $2 AND (LOWER(actor) = $1 OR LOWER(previous_owner) = $1)`,
      [wallet, BOARD_ID]
    ),
  ]);

  return NextResponse.json({
    wallet,
    seatsHeld: seatsRes.rows.length,
    stats: statsRes.rows[0],
    seats: seatsRes.rows,
  });
}
