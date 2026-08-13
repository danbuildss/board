'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { fmtAddr, fmtUSDG } from '@/lib/format'

type HolderRow   = { owner: string; seats_held: string }
type TakeoverRow = { wallet: string; takeovers: string }
type EarnerRow   = { wallet: string; total_earned: string }
type LongestRow  = { wallet: string; total_days: string }

type LbData = {
  topHolders:     HolderRow[]
  topTakeovers:   TakeoverRow[]
  topEarners:     EarnerRow[]
  longestHolders: LongestRow[]
}

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
            <span />
          </div>
          {(data?.topHolders ?? []).map((row, i) => {
            const isMe = row.owner.toLowerCase() === me
            return (
              <Link key={i} href={`/profile/${row.owner}`} className={`lb-row${isMe ? ' me' : ''}`}>
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-addr">
                  {fmtAddr(row.owner)}
                  {isMe && <span className="you-tag">YOU</span>}
                </span>
                <span className="lb-val">{row.seats_held}</span>
                <span />
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
            <span />
          </div>
          {(data?.topTakeovers ?? []).map((row, i) => {
            const isMe = row.wallet.toLowerCase() === me
            return (
              <Link key={i} href={`/profile/${row.wallet}`} className={`lb-row${isMe ? ' me' : ''}`}>
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-addr">
                  {fmtAddr(row.wallet)}
                  {isMe && <span className="you-tag">YOU</span>}
                </span>
                <span className="lb-val">{row.takeovers}</span>
                <span />
              </Link>
            )
          })}
          {(data?.topTakeovers ?? []).length === 0 && (
            <div className="empty-state">No data yet</div>
          )}
        </div>
      </div>

      <div className="lb-section">
        <div className="lb-section-head">
          <div className="lb-section-title">Top Earners</div>
          <div className="lb-section-sub">By total rewards earned all-time</div>
        </div>
        <div className="lb-table">
          <div className="lb-head">
            <span>#</span>
            <span>Wallet</span>
            <span style={{ textAlign: 'right' }}>Earned</span>
            <span />
          </div>
          {(data?.topEarners ?? []).map((row, i) => {
            const isMe = row.wallet?.toLowerCase() === me
            return (
              <Link key={i} href={`/profile/${row.wallet}`} className={`lb-row${isMe ? ' me' : ''}`}>
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-addr">
                  {fmtAddr(row.wallet)}
                  {isMe && <span className="you-tag">YOU</span>}
                </span>
                <span className="lb-val">{fmtUSDG(row.total_earned)}</span>
                <span />
              </Link>
            )
          })}
          {(data?.topEarners ?? []).length === 0 && (
            <div className="empty-state">No data yet</div>
          )}
        </div>
      </div>

      <div className="lb-section">
        <div className="lb-section-head">
          <div className="lb-section-title">Longest Holders</div>
          <div className="lb-section-sub">By total days holding seats</div>
        </div>
        <div className="lb-table">
          <div className="lb-head">
            <span>#</span>
            <span>Wallet</span>
            <span style={{ textAlign: 'right' }}>Days</span>
            <span />
          </div>
          {(data?.longestHolders ?? []).map((row, i) => {
            const isMe = row.wallet?.toLowerCase() === me
            return (
              <Link key={i} href={`/profile/${row.wallet}`} className={`lb-row${isMe ? ' me' : ''}`}>
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-addr">
                  {fmtAddr(row.wallet)}
                  {isMe && <span className="you-tag">YOU</span>}
                </span>
                <span className="lb-val">{parseFloat(row.total_days).toFixed(1)}d</span>
                <span />
              </Link>
            )
          })}
          {(data?.longestHolders ?? []).length === 0 && (
            <div className="empty-state">No data yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
