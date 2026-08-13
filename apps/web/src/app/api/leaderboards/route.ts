export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const BOARD_ID = process.env.BOARD_ID ?? 'hood';

export async function GET() {
  const [holdersRes, takeoversRes, earnersRes, longestRes] = await Promise.all([
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
    pool.query(
      `WITH claims AS (
         SELECT LOWER(wallet) AS wallet, COALESCE(SUM(amount::numeric), 0) AS claimed
         FROM reward_claims WHERE board_id = $1 GROUP BY LOWER(wallet)
       ),
       banked AS (
         SELECT LOWER(s.owner) AS wallet, COALESCE(SUM(srs.cumulative_banked::numeric), 0) AS banked
         FROM seat_reward_state srs
         JOIN seats s ON srs.board_id = s.board_id AND srs.seat_id = s.seat_id
         WHERE srs.board_id = $1 AND s.owner IS NOT NULL
         GROUP BY LOWER(s.owner)
       )
       SELECT
         COALESCE(c.wallet, b.wallet) AS wallet,
         (COALESCE(c.claimed, 0) + COALESCE(b.banked, 0))::text AS total_earned
       FROM claims c
       FULL OUTER JOIN banked b ON c.wallet = b.wallet
       ORDER BY (COALESCE(c.claimed, 0) + COALESCE(b.banked, 0)) DESC
       LIMIT 20`,
      [BOARD_ID]
    ),
    pool.query(
      `WITH acquisitions AS (
         SELECT LOWER(actor) AS wallet, seat_id, occurred_at AS start_time
         FROM seat_events
         WHERE board_id = $1 AND event_type IN ('SeatAcquired', 'SeatTaken') AND actor IS NOT NULL
       ),
       losses AS (
         SELECT LOWER(previous_owner) AS wallet, seat_id, occurred_at AS end_time
         FROM seat_events
         WHERE board_id = $1 AND event_type IN ('SeatTaken', 'SeatForeclosed') AND previous_owner IS NOT NULL
       ),
       holds AS (
         SELECT a.wallet, a.seat_id, a.start_time,
           (SELECT MIN(l.end_time) FROM losses l
            WHERE l.wallet = a.wallet AND l.seat_id = a.seat_id AND l.end_time > a.start_time) AS end_time
         FROM acquisitions a
       )
       SELECT wallet,
         ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time))) / 86400, 1)::text AS total_days
       FROM holds
       WHERE wallet IS NOT NULL
       GROUP BY wallet
       ORDER BY SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time))) DESC
       LIMIT 20`,
      [BOARD_ID]
    ),
  ]);

  return NextResponse.json({
    topHolders:     holdersRes.rows,
    topTakeovers:   takeoversRes.rows,
    topEarners:     earnersRes.rows,
    longestHolders: longestRes.rows,
  });
}
