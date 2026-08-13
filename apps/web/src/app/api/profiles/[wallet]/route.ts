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

  const [seatsRes, statsRes, rewardsRes, formerSeatsRes] = await Promise.all([
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
    pool.query(
      `SELECT (
         COALESCE(
           (SELECT SUM(srs.cumulative_banked::numeric)
            FROM seat_reward_state srs
            JOIN seats s ON srs.board_id = s.board_id AND srs.seat_id = s.seat_id
            WHERE srs.board_id = $2 AND LOWER(s.owner) = $1),
           0
         ) +
         COALESCE(
           (SELECT SUM(amount::numeric) FROM reward_claims WHERE board_id = $2 AND LOWER(wallet) = $1),
           0
         )
       )::text AS lifetime_rewards`,
      [wallet, BOARD_ID]
    ),
    pool.query(
      `SELECT DISTINCT ON (seat_id) seat_id, event_type, occurred_at
       FROM seat_events
       WHERE board_id = $2 AND LOWER(previous_owner) = $1
         AND event_type IN ('SeatTaken', 'SeatForeclosed')
       ORDER BY seat_id, occurred_at DESC`,
      [wallet, BOARD_ID]
    ),
  ]);

  const currentSeatIds = new Set(seatsRes.rows.map((s: { seat_id: number }) => s.seat_id));
  const formerSeats = formerSeatsRes.rows.filter((s: { seat_id: number }) => !currentSeatIds.has(s.seat_id));

  return NextResponse.json({
    wallet,
    seatsHeld: seatsRes.rows.length,
    stats: statsRes.rows[0],
    seats: seatsRes.rows,
    lifetimeRewards: rewardsRes.rows[0]?.lifetime_rewards ?? '0',
    formerSeats,
  });
}
