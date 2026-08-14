'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { fmtUSDG, padSeat, weeksRemaining } from '@/lib/format'

type Seat = {
  seatId: number
  status: 'VACANT' | 'ACTIVE' | 'GRACE' | 'FORECLOSABLE'
  owner: string | null
  price: string | null
  effectiveBalance: string
  weeklyHoldingCost: string
  estimatedDepletionAt: string | null
  graceEndsAt: string | null
}

type BoardRewardDeposit = { amount: string; occurred_at: string }
type BoardRewards = {
  activeSeatCount: number
  recentDeposits: BoardRewardDeposit[]
}

function SeatNotifications({ seats, me }: { seats: Seat[]; me: string | undefined }) {
  if (!me) return null
  const warnings: { seatId: number; kind: 'grace' | 'low' | 'foreclosable' }[] = []
  for (const s of seats) {
    if (s.owner?.toLowerCase() !== me) continue
    if (s.status === 'FORECLOSABLE') {
      warnings.push({ seatId: s.seatId, kind: 'foreclosable' })
    } else if (s.status === 'GRACE') {
      warnings.push({ seatId: s.seatId, kind: 'grace' })
    } else if (s.status === 'ACTIVE' && s.price && s.effectiveBalance) {
      const weeks = parseFloat(weeksRemaining(BigInt(s.effectiveBalance), BigInt(s.price)))
      if (weeks < 2) warnings.push({ seatId: s.seatId, kind: 'low' })
    }
  }
  if (!warnings.length) return null
  return (
    <div className="notif-strip">
      {warnings.map(w => (
        <div key={w.seatId} className={`notif-item ni-${w.kind}`}>
          <span className="ni-icon">{w.kind === 'foreclosable' ? '✕' : '!'}</span>
          <span className="ni-text">
            {w.kind === 'grace'
              ? `${padSeat(w.seatId)} IN GRACE — top up to stay active`
              : w.kind === 'foreclosable'
              ? `${padSeat(w.seatId)} FORECLOSABLE — act now`
              : `${padSeat(w.seatId)} LOW RESERVE — less than 2 weeks remaining`}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function HoodPage() {
  const { address } = useAccount()
  const router = useRouter()

  const { data: seatsData } = useQuery<{ seats: Seat[] }>({
    queryKey: ['seats'],
    queryFn: () => fetch('/api/boards/genesis/seats').then(r => r.json()),
  })
  const seats = seatsData?.seats ?? []

  const { data: boardData } = useQuery<{ stats: Record<string, number> }>({
    queryKey: ['board-stats'],
    queryFn: () => fetch('/api/boards/genesis').then(r => r.json()),
  })
  const stats = boardData?.stats

  const { data: boardRewards } = useQuery<BoardRewards>({
    queryKey: ['board-rewards-summary'],
    queryFn: () => fetch('/api/boards/genesis/rewards').then(r => r.json()),
    refetchInterval: 60_000,
  })

  const [tooltipSeat, setTooltipSeat] = useState<Seat | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const isMine = (seat: Seat) =>
    !!seat.owner && !!address && seat.owner.toLowerCase() === address.toLowerCase()

  const perSeatWeekly7d = (() => {
    if (!boardRewards) return 0n
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const total7d = boardRewards.recentDeposits
      .filter(d => new Date(d.occurred_at).getTime() > cutoff)
      .reduce((s, d) => s + BigInt(d.amount), 0n)
    const n = BigInt(Math.max(1, boardRewards.activeSeatCount))
    return total7d / n
  })()

  const gridSeats: Seat[] = Array.from({ length: 100 }, (_, i) => {
    const id = i + 1
    return seats.find(s => s.seatId === id) ?? {
      seatId: id, status: 'VACANT' as const, owner: null, price: null,
      effectiveBalance: '0', weeklyHoldingCost: '0',
      estimatedDepletionAt: null, graceEndsAt: null,
    }
  })

  return (
    <div className="page-scroll">
      <div className="page-inner">
        <div className="board-toolbar">
          <div>
            <div className="board-market-label">MARKET</div>
            <div className="board-title-row">
              <span className="board-title">BOARD #001 / GENESIS</span>
              <span className="mkt-pill">100 SEATS</span>
            </div>
          </div>
          {stats && (
            <div className="counts">
              <span className="cpill"><span className="cdot cd-a" />{stats.active} ACTIVE</span>
              <span className="cpill"><span className="cdot cd-v" />{stats.vacant} VACANT</span>
              {stats.grace > 0 && <span className="cpill"><span className="cdot cd-g" />{stats.grace} GRACE</span>}
              {stats.foreclosable > 0 && <span className="cpill"><span className="cdot cd-f" />{stats.foreclosable} FORECLOSE</span>}
            </div>
          )}
        </div>

        <SeatNotifications seats={seats} me={address?.toLowerCase()} />

        <div className="seat-grid">
          {gridSeats.map(seat => {
            const mine = isMine(seat)
            const cls = ['stile', seat.status.toLowerCase(), mine && 'mine']
              .filter(Boolean).join(' ')
            return (
              <div
                key={seat.seatId}
                className={cls}
                onClick={() => router.push(`/board/genesis/seat/${seat.seatId}`)}
                onMouseEnter={e => { setTooltipSeat(seat); setTooltipPos({ x: e.clientX, y: e.clientY }) }}
                onMouseMove={e => setTooltipPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltipSeat(null)}
              >
                <span className="stile-num">{padSeat(seat.seatId)}</span>
                {seat.price && <span className="stile-price">{fmtUSDG(seat.price)}</span>}
                {seat.status !== 'VACANT' && seat.weeklyHoldingCost && (() => {
                  const carry = perSeatWeekly7d - BigInt(seat.weeklyHoldingCost)
                  return (
                    <span className={`stile-carry ${carry >= 0n ? 'pos' : 'neg'}`}>
                      {carry >= 0n ? '+' : '-'}{fmtUSDG(carry >= 0n ? carry : -carry)}
                    </span>
                  )
                })()}
                {mine && <span className="stile-mine-tag">YOU</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Seat tooltip */}
      {tooltipSeat && (
        <div
          className="seat-tooltip"
          style={{ left: tooltipPos.x + 16, top: tooltipPos.y + 16 }}
        >
          <div className="tt-head">SEAT {padSeat(tooltipSeat.seatId)}</div>
          {tooltipSeat.status !== 'VACANT' ? (() => {
            const holdingCost = BigInt(tooltipSeat.weeklyHoldingCost)
            const carry = perSeatWeekly7d - holdingCost
            return (
              <>
                <div className="tt-row">
                  <span className="tt-label">ASK</span>
                  <span className="tt-val">{fmtUSDG(tooltipSeat.price!)}</span>
                </div>
                <div className="tt-row">
                  <span className="tt-label">7D REWARDS</span>
                  <span className="tt-val g">{fmtUSDG(perSeatWeekly7d)}</span>
                </div>
                <div className="tt-row">
                  <span className="tt-label">7D COST</span>
                  <span className="tt-val dim">{fmtUSDG(holdingCost)}</span>
                </div>
                <div className="tt-row">
                  <span className="tt-label">NET CARRY</span>
                  <span className={`tt-val ${carry >= 0n ? 'g' : 'r'}`}>
                    {carry >= 0n ? '+' : '-'}{fmtUSDG(carry >= 0n ? carry : -carry)}
                  </span>
                </div>
                <div className="tt-row">
                  <span className="tt-label">RUNWAY</span>
                  <span className="tt-val">
                    {weeksRemaining(BigInt(tooltipSeat.effectiveBalance), BigInt(tooltipSeat.price ?? '0'))}w
                  </span>
                </div>
                <div className="tt-row">
                  <span className="tt-label">STATUS</span>
                  <span className="tt-val" style={{
                    color: tooltipSeat.status === 'ACTIVE' ? 'var(--green)'
                      : tooltipSeat.status === 'GRACE' ? 'var(--amber)' : 'var(--red)',
                  }}>
                    {tooltipSeat.status === 'ACTIVE' ? 'SAFE'
                      : tooltipSeat.status === 'GRACE' ? 'GRACE'
                      : 'AT RISK'}
                  </span>
                </div>
                <div className="tt-row" style={{ marginTop: 6, borderTop: '1px solid var(--bd0)', paddingTop: 6 }}>
                  <span className="tt-label" style={{ color: 'var(--green)' }}>→ View Seat</span>
                </div>
              </>
            )
          })() : (
            <>
              <div className="tt-row">
                <span className="tt-label">STATUS</span>
                <span className="tt-val" style={{ color: 'var(--t3)' }}>VACANT</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">TAKE PRICE</span>
                <span className="tt-val">$10.00</span>
              </div>
              <div className="tt-row" style={{ marginTop: 6, borderTop: '1px solid var(--bd0)', paddingTop: 6 }}>
                <span className="tt-label" style={{ color: 'var(--green)' }}>→ Take Seat</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
