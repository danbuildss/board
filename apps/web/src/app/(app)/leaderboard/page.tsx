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

  if (isLoading) {
    return (
      <div className="page-scroll">
        <div className="empty-state"><span className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="lb-grid">
      <div className="lb-section">
        <div className="lb-section-head">
          <div className="lb-section-title">Top Seat Holders</div>
          <div className="lb-section-sub">Ranked by seats currently owned</div>
        </div>
        <div className="lb-table">
          <div className="lb-head">
            <span>#</span>
            <span>Wallet</span>
            <span style={{ textAlign: 'right' }}>Seats</span>
            <span style={{ textAlign: 'right' }}>Value</span>
          </div>
          {(data?.topHolders ?? []).map((row, i) => {
            const isMe = row.owner.toLowerCase() === me
            return (
              <Link
                key={i}
                href={`/profile/${row.owner}`}
                className={`lb-row${isMe ? ' me' : ''}`}
              >
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-addr">
                  {fmtAddr(row.owner)}
                  {isMe && <span className="you-tag">YOU</span>}
                </span>
                <span className="lb-val">{row.seats_held}</span>
                <span className="lb-sub">—</span>
              </Link>
            )
          })}
          {(data?.topHolders ?? []).length === 0 && (
            <div className="empty-state">No data yet</div>
          )}
        </div>
      </div>

      <div className="lb-section">
        <div className="lb-section-head">
          <div className="lb-section-title">Top Takeover Initiators</div>
          <div className="lb-section-sub">By takeovers completed all-time</div>
        </div>
        <div className="lb-table">
          <div className="lb-head">
            <span>#</span>
            <span>Wallet</span>
            <span style={{ textAlign: 'right' }}>Takeovers</span>
            <span style={{ textAlign: 'right' }}>Volume</span>
          </div>
          {(data?.topTakeovers ?? []).map((row, i) => {
            const isMe = row.wallet.toLowerCase() === me
            return (
              <Link
                key={i}
                href={`/profile/${row.wallet}`}
                className={`lb-row${isMe ? ' me' : ''}`}
              >
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-addr">
                  {fmtAddr(row.wallet)}
                  {isMe && <span className="you-tag">YOU</span>}
                </span>
                <span className="lb-val">{row.takeovers}</span>
                <span className="lb-sub">—</span>
              </Link>
            )
          })}
          {(data?.topTakeovers ?? []).length === 0 && (
            <div className="empty-state">No data yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
