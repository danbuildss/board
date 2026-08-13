export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string; seatId: string }> }
) {
  const { boardId, seatId: seatIdStr } = await params;
  const seatId = parseInt(seatIdStr, 10);

  if (isNaN(seatId) || seatId < 1) {
    return NextResponse.json({ error: 'Invalid seat ID' }, { status: 400 });
  }

  const [seatRes, rewardRes] = await Promise.all([
    pool.query(
      `SELECT seat_id, owner, status FROM seats WHERE board_id = $1 AND seat_id = $2`,
      [boardId, seatId]
    ),
    pool.query(
      `SELECT cumulative_banked FROM seat_reward_state WHERE board_id = $1 AND seat_id = $2`,
      [boardId, seatId]
    ),
  ]);

  if (!seatRes.rows[0]) {
    return NextResponse.json({ error: 'Seat not found' }, { status: 404 });
  }

  const seat = seatRes.rows[0];
  const reward = rewardRes.rows[0];

  return NextResponse.json({
    boardId,
    seatId,
    owner:            seat.owner ?? null,
    status:           seat.status,
    cumulativeBanked: reward?.cumulative_banked ?? '0',
  });
}
