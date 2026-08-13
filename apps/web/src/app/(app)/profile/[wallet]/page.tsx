'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { fmtAddr, padSeat, fmtUSDG, fmtDate, eventLabel } from '@/lib/format'

type ProfileData = {
  wallet: string
  seatsHeld: number
  lifetimeRewards: string
  stats: {
    seats_taken: string
    takeovers_initiated: string
    seats_foreclosed: string
  }
  seats: {
    seat_id: number
    status: string
    price: string | null
  }[]
  formerSeats: {
    seat_id: number
    event_type: string
    occurred_at: string | null
  }[]
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--green)',
  GRACE: 'var(--amber)',
  FORECLOSABLE: 'var(--red)',
  VACANT: 'var(--t3)',
}

export default function ProfilePage() {
  const params = useParams<{ wallet: string }>()
  const wallet = params?.wallet ?? ''
  const { address } = useAccount()
  const isMe = address?.toLowerCase() === wallet?.toLowerCase()

  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ['profile', wallet],
    queryFn: () => fetch(`/api/profiles/${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  })

  if (!wallet) {
    return (
      <div className="page-scroll">
        <div className="empty-state">No wallet address provided</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="page-scroll">
        <div className="empty-state"><span className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="page-scroll">
      <div className="pf-wrap">
        <div>
          <div className="pf-header">
            <div className="pf-avatar">◆</div>
            <div>
              <div className="pf-addr">{fmtAddr(wallet)}</div>
              {isMe && <div className="pf-since">Your profile</div>}
            </div>
          </div>
        </div>

        <div className="pf-stats-grid">
          <div className="pf-stat">
            <div className="pf-sv">{data?.seatsHeld ?? 0}</div>
            <div className="pf-sl">Seats Held</div>
          </div>
          <div className="pf-stat">
            <div className="pf-sv">{data?.stats?.seats_taken ?? 0}</div>
            <div className="pf-sl">Seats Taken</div>
          </div>
          <div className="pf-stat">
            <div className="pf-sv">{data?.stats?.takeovers_initiated ?? 0}</div>
            <div className="pf-sl">Takeovers</div>
          </div>
          <div className="pf-stat">
            <div className="pf-sv">{data?.stats?.seats_foreclosed ?? 0}</div>
            <div className="pf-sl">Foreclosed</div>
          </div>
        </div>

        <div className="pf-rewards-row">
          <div className="pf-rewards-label">LIFETIME REWARDS</div>
          <div className="pf-rewards-val">{fmtUSDG(data?.lifetimeRewards ?? '0')}</div>
        </div>

        {data?.seats && data.seats.length > 0 ? (
          <div>
            <div className="section-title">Current Seats</div>
            <div className="pf-seat-list">
              <div className="pf-seat-head">
                <span>Seat</span>
                <span>Status</span>
                <span>Price</span>
                <span />
                <span />
                <span />
              </div>
              {data.seats.map(s => (
                <Link
                  key={s.seat_id}
                  href="/board/genesis"
                  className="pf-seat-row"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="pf-c1">{padSeat(s.seat_id)}</span>
                  <span
                    className="pf-c3"
                    style={{ color: STATUS_COLOR[s.status] ?? 'var(--t2)' }}
                  >
                    {s.status}
                  </span>
                  <span className="pf-c3">{s.price ? fmtUSDG(s.price) : '—'}</span>
                  <span />
                  <span />
                  <span />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">No seats currently held</div>
        )}

        {data?.formerSeats && data.formerSeats.length > 0 && (
          <div>
            <div className="section-title">Former Seats</div>
            <div className="pf-seat-list">
              <div className="pf-seat-head">
                <span>Seat</span>
                <span>Lost Via</span>
                <span>Date</span>
                <span />
                <span />
                <span />
              </div>
              {data.formerSeats.map(s => (
                <div key={s.seat_id} className="pf-seat-row pf-former-row">
                  <span className="pf-c1">{padSeat(s.seat_id)}</span>
                  <span
                    className="pf-c3"
                    style={{ color: s.event_type === 'SeatForeclosed' ? 'var(--red)' : 'var(--t2)' }}
                  >
                    {eventLabel(s.event_type)}
                  </span>
                  <span className="pf-c3" style={{ color: 'var(--t3)' }}>{fmtDate(s.occurred_at)}</span>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
