'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { fmtAddr } from '@/lib/format'

type HolderRow = { owner: string; seats_held: string }
type TakeoverRow = { wallet: string; takeovers: string }
type LbData = { topHolders: HolderRow[]; topTakeovers: TakeoverRow[] }

export default function LeaderboardPage() {
  const { address } = useAccount()
  const me = address?.toLowerCase()

  const { data, isLoading } = useQuery<LbData>({
    queryKey: ['leaderboard'],
    queryFn: () => fetch('/api/leaderboards').then(r => r.json()),
  })

  return (
    <div className="page-scroll">
      <div className="lb-wrap">
        {isLoading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : (
          <div className="lb-grid">
            <div>
              <div className="section-title">Top Seat Holders</div>
              <div className="lb-head">
                <span>#</span>
                <span>Wallet</span>
                <span style={{ textAlign: 'right' }}>Seats</span>
                <span />
              </div>
              {(data?.topHolders ?? []).map((row, i) => {
                const isMe = row.owner.toLowerCase() === me
                return (
                  <Link
                    key={i}
                    href={`/profile/${row.owner}`}
                    className={`lb-row${isMe ? ' me' : ''}`}
                    style={{ textDecoration: 'none', display: 'grid',
                      gridTemplateColumns: '28px 1fr auto 60px',
                      gap: 8, padding: '7px 8px', borderBottom: '1px solid var(--bd)',
                      fontSize: 12, alignItems: 'baseline', cursor: 'pointer' }}
                  >
                    <span className="lb-rank">{i + 1}</span>
                    <span className="lb-addr">
                      {fmtAddr(row.owner)}
                      {isMe && <span className="you-tag">YOU</span>}
                    </span>
                    <span className="lb-val" style={{ textAlign: 'right' }}>{row.seats_held}</span>
                    <span />
                  </Link>
                )
              })}
              {(data?.topHolders ?? []).length === 0 && (
                <div className="empty-state">No data yet</div>
              )}
            </div>

            <div>
              <div className="section-title">Most Takeovers</div>
              <div className="lb-head">
                <span>#</span>
                <span>Wallet</span>
                <span style={{ textAlign: 'right' }}>Takeovers</span>
                <span />
              </div>
              {(data?.topTakeovers ?? []).map((row, i) => {
                const isMe = row.wallet.toLowerCase() === me
                return (
                  <Link
                    key={i}
                    href={`/profile/${row.wallet}`}
                    className={`lb-row${isMe ? ' me' : ''}`}
                    style={{ textDecoration: 'none', display: 'grid',
                      gridTemplateColumns: '28px 1fr auto 60px',
                      gap: 8, padding: '7px 8px', borderBottom: '1px solid var(--bd)',
                      fontSize: 12, alignItems: 'baseline', cursor: 'pointer' }}
                  >
                    <span className="lb-rank">{i + 1}</span>
                    <span className="lb-addr">
                      {fmtAddr(row.wallet)}
                      {isMe && <span className="you-tag">YOU</span>}
                    </span>
                    <span className="lb-val" style={{ textAlign: 'right' }}>{row.takeovers}</span>
                    <span />
                  </Link>
                )
              })}
              {(data?.topTakeovers ?? []).length === 0 && (
                <div className="empty-state">No data yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
