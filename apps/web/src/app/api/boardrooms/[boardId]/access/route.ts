export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { deriveStatus } from '@/lib/status';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const wallet = req.nextUrl.searchParams.get('wallet')?.toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: 'wallet param required' }, { status: 400 });
  }

  const res = await pool.query(
    `SELECT seat_id, owner, price, prepaid_balance, last_settled_at
     FROM seats
     WHERE board_id = $1 AND LOWER(owner) = $2`,
    [boardId, wallet]
  );

  const eligibleSeat = res.rows.find(row => {
    const s = deriveStatus(row);
    return s === 'ACTIVE' || s === 'GRACE';
  });

  return NextResponse.json({
    wallet,
    access:  !!eligibleSeat,
    seatId:  eligibleSeat?.seat_id ?? null,
    reason:  eligibleSeat ? null : 'No ACTIVE or GRACE seat held',
  });
}
