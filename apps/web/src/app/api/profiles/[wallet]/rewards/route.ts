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

  const [claimedRes, bankedRes] = await Promise.all([
    // Total claimed by this wallet
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_claimed
       FROM reward_claims
       WHERE board_id = $1 AND owner = $2`,
      [BOARD_ID, wallet]
    ),
    // Cumulative banked across all seats this wallet has owned
    pool.query(
      `SELECT srs.seat_id, srs.cumulative_banked
       FROM seat_reward_state srs
       JOIN seats s ON s.board_id = srs.board_id AND s.seat_id = srs.seat_id
       WHERE srs.board_id = $1 AND LOWER(s.owner) = $2`,
      [BOARD_ID, wallet]
    ),
  ]);

  const totalClaimed = claimedRes.rows[0]?.total_claimed ?? '0';
  const activeSeatRewards = bankedRes.rows;
  const totalBankedActive = activeSeatRewards.reduce(
    (sum: bigint, r: { cumulative_banked: string }) => sum + BigInt(r.cumulative_banked || '0'),
    0n
  );

  return NextResponse.json({
    wallet,
    boardId:           BOARD_ID,
    totalClaimed,
    activeSeatRewards,
    totalBankedActive: totalBankedActive.toString(),
  });
}
