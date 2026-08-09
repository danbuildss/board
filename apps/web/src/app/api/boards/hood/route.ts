export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  const [boardRes, statsRes] = await Promise.all([
    pool.query(`SELECT * FROM boards WHERE id = 'hood'`),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'VACANT')       AS vacant,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')       AS active,
        COUNT(*) FILTER (WHERE status = 'GRACE')        AS grace,
        COUNT(*) FILTER (WHERE status = 'FORECLOSABLE') AS foreclosable,
        COUNT(DISTINCT owner) FILTER (WHERE owner IS NOT NULL) AS unique_owners
      FROM seats WHERE board_id = 'hood'
    `),
  ]);

  if (!boardRes.rows[0]) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const b = boardRes.rows[0];
  const s = statsRes.rows[0];

  return NextResponse.json({
    id: b.id,
    name: b.name,
    chainId: b.chain_id,
    contractAddress: b.contract_address,
    seatCount: b.seat_count,
    deploymentBlock: b.deployment_block,
    settlementAsset: b.settlement_asset,
    stats: {
      vacant:       parseInt(s.vacant),
      active:       parseInt(s.active),
      grace:        parseInt(s.grace),
      foreclosable: parseInt(s.foreclosable),
      uniqueOwners: parseInt(s.unique_owners),
    },
  });
}
