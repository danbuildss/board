'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { fmtAddr, padSeat, fmtUSDG, weeksRemaining } from '@/lib/format'

type AccessData = {
  wallet: string
  access: boolean
  seatId: number | null
  reason: string | null
}

type Seat = {
  seatId: number
  status: 'VACANT' | 'ACTIVE' | 'GRACE' | 'FORECLOSABLE'
  owner: string | null
  price: string | null
  effectiveBalance: string
  weeklyHoldingCost: string
}

type BoardData = {
  stats: { active: number; grace: number; foreclosable: number; uniqueOwners: number }
}

export default function BoardroomPage() {
  const { address, isConnected } = useAccount()

  const { data: accessData } = useQuery<AccessData>({
    queryKey: ['boardroom-access', address],
    queryFn: () => fetch(`/api/boardrooms/genesis/access?wallet=${address}`).then(r => r.json()),
    enabled: !!address,
  })

  const { data: seatsData } = useQuery<{ seats: Seat[] }>({
    queryKey: ['seats'],
    queryFn: () => fetch('/api/boards/genesis/seats').then(r => r.json()),
  })

  const { data: boardData } = useQuery<BoardData>({
    queryKey: ['board-stats'],
    queryFn: () => fetch('/api/boards/genesis').then(r => r.json()),
  })

  const hasAccess = accessData?.access ?? false
  const me = address?.toLowerCase()

  // All active (and grace) seats sorted by seatId
  const activeSeats = (seatsData?.seats ?? [])
    .filter(s => s.owner && (s.status === 'ACTIVE' || s.status === 'GRACE'))
    .sort((a, b) => a.seatId - b.seatId)

  if (!isConnected) {
    return (
      <div className="page-scroll">
        <div className="br-wrap">
          <div className="br-access denied">
            <div>
              <div className="br-tag">Connect Wallet</div>
              <div className="br-detail">Connect to check Boardroom access</div>
            </div>
            <div className="br-icon">🔒</div>
          </div>
          <div className="empty-state">
            Boardroom is for Seat holders only.<br />
            Hold an <span style={{ color: 'var(--green)' }}>ACTIVE</span> or{' '}
            <span style={{ color: 'var(--amber)' }}>GRACE</span> seat to enter.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-scroll">
      <div className="br-wrap">
        {/* Access banner */}
        <div className={`br-access ${hasAccess ? 'granted' : 'denied'}`}>
          <div>
            <div className="br-tag">
              {hasAccess ? 'BOARDROOM ACCESS GRANTED' : 'ACCESS DENIED'}
            </div>
            <div className="br-detail">
              {hasAccess
                ? `Via Seat ${accessData?.seatId != null ? padSeat(accessData.seatId) : ''}`
                : 'Hold an ACTIVE or GRACE seat to enter'}
            </div>
          </div>
          <div className="br-icon">{hasAccess ? '✦' : '🔒'}</div>
        </div>

        {!hasAccess && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Link href="/board/genesis" className="cta-btn" style={{ display: 'inline-flex' }}>
              Take a Seat →
            </Link>
          </div>
        )}

        {hasAccess && (
          <>
            {/* Market stats */}
            <div className="br-market">
              <div className="br-mrow">
                <span className="br-ml">Active Seats</span>
                <span className="br-mv">{boardData?.stats?.active ?? '—'}</span>
              </div>
              <div className="br-mrow">
                <span className="br-ml">In Grace</span>
                <span className="br-mv">{boardData?.stats?.grace ?? '—'}</span>
              </div>
              <div className="br-mrow">
                <span className="br-ml">Unique Owners</span>
                <span className="br-mv">{boardData?.stats?.uniqueOwners ?? '—'}</span>
              </div>
              <div className="br-mrow">
                <span className="br-ml">Members</span>
                <span className="br-mv">{activeSeats.length}</span>
              </div>
            </div>

            {/* Members list — individual seats */}
            <div>
              <div className="br-section-head">
                <div className="br-section-title">Current Members</div>
                <div className="br-section-sub">{activeSeats.length} active seats</div>
              </div>
              <div className="br-list">
                <div className="br-head">
                  <span>Seat</span>
                  <span>Wallet</span>
                  <span style={{ textAlign: 'right' }}>Price</span>
                  <span style={{ textAlign: 'right' }}>Balance</span>
                  <span style={{ textAlign: 'right' }}>Coverage</span>
                </div>
                {activeSeats.length === 0 ? (
                  <div className="empty-state">No active members</div>
                ) : (
                  activeSeats.map(seat => {
                    const isMe = seat.owner?.toLowerCase() === me
                    const wks = seat.price && seat.price !== '0'
                      ? weeksRemaining(BigInt(seat.effectiveBalance), BigInt(seat.price))
                      : '—'
                    return (
                      <Link
                        key={seat.seatId}
                        href={`/profile/${seat.owner}`}
                        className={`br-row${isMe ? ' me-row' : ''}`}
                      >
                        <span className="br-c1">{padSeat(seat.seatId)}</span>
                        <span className="br-c2">
                          {fmtAddr(seat.owner!)}
                          {isMe && <span className="you-tag">YOU</span>}
                        </span>
                        <span className="br-c3">
                          {seat.price ? fmtUSDG(seat.price) : '—'}
                        </span>
                        <span className="br-c4">{fmtUSDG(seat.effectiveBalance)}</span>
                        <span
                          className="br-c5"
                          style={{
                            color: seat.status === 'GRACE' ? 'var(--amber)' : 'var(--t3)',
                          }}
                        >
                          {seat.status === 'GRACE' ? 'GRACE' : `${wks}w`}
                        </span>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
