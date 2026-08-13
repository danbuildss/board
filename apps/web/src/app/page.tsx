'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { fmtUSDG, padSeat, eventLabel, weeklyFee } from '@/lib/format'

type Seat = { seatId: number; status: string; price?: string; weeklyHoldingCost?: string }
type BoardRewardsData = {
  activeSeatCount: number
  recentDeposits: { amount: string; occurred_at: string }[]
}
type ActivityEvent = {
  event_type: string
  seat_id: number
  new_price: string | null
  previous_price: string | null
  amount: string | null
  occurred_at: string | null
  tx_hash: string | null
}
type BoardStats = {
  active: number
  vacant: number
  grace: number
  foreclosable: number
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/* Map contract status → display status */
function displayStatus(s: string): string {
  if (s === 'active') return 'safe'
  if (s === 'foreclosable') return 'at-risk'
  if (s === 'grace') return 'grace2'
  return 'vacant'
}

function statusLabel(s: string): string {
  if (s === 'active') return 'SAFE'
  if (s === 'foreclosable') return 'AT RISK'
  if (s === 'grace') return 'GRACE'
  return 'VACANT'
}

/* Simple SVG sparkline */
function SparkLine({ color = 'var(--green)' }: { color?: string }) {
  const pts = [12, 8, 14, 7, 11, 9, 13, 6, 10, 8, 5, 7, 9, 4, 6]
  const max = Math.max(...pts), min = Math.min(...pts)
  const h = 20, w = 80
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg className="l-sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* Concentric square seat art */
function ConcentricArt({ seatId }: { seatId: number }) {
  const layers = [
    { size: 120, color: '#1a2a00' },
    { size: 98,  color: '#2a4400' },
    { size: 76,  color: '#3a6000' },
    { size: 54,  color: '#5a9000' },
    { size: 34,  color: '#8acc00' },
    { size: 16,  color: '#b7ff1a' },
  ]
  return (
    <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {layers.map((l, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: l.size, height: l.size,
          border: `1px solid ${l.color}`,
        }} />
      ))}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green)', fontWeight: 700, zIndex: 1, letterSpacing: '.06em' }}>
        {padSeat(seatId)}
      </span>
    </div>
  )
}

/* Board terminal with row/col labels */
function BoardTerminal({ seats }: { seats: Seat[] }) {
  const [hovered, setHovered] = useState<number | null>(null)

  const grid: Seat[] = Array.from({ length: 100 }, (_, i) => {
    const id = i + 1
    return seats.find(s => s.seatId === id) ?? { seatId: id, status: 'vacant' }
  })

  const hoveredSeat = hovered !== null ? grid.find(s => s.seatId === hovered) ?? null : null

  return (
    <div className="board-terminal">
      <div className="bt-header">
        <span className="bt-title">BOARD #001 / GENESIS · USDG</span>
        <span className="bt-live">
          <span className="bt-live-dot" />
          LIVE
        </span>
      </div>

      <div className="bt-labeled-wrap">
        {/* Column numbers */}
        <div className="bt-col-nums">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="bt-col-num">{String(i + 1).padStart(2, '0')}</div>
          ))}
        </div>

        {/* Rows */}
        <div className="bt-rows">
          {Array.from({ length: 10 }, (_, row) => (
            <div key={row} className="bt-grid-row">
              <span className="bt-row-num">{String(row + 1).padStart(2, '0')}</span>
              {Array.from({ length: 10 }, (_, col) => {
                const seat = grid[row * 10 + col]
                const ds = displayStatus(seat.status)
                const isHov = hovered === seat.seatId
                return (
                  <div
                    key={col}
                    className={`bt-seat ${ds}${isHov ? ' highlighted' : ''}`}
                    onMouseEnter={() => setHovered(seat.seatId)}
                    onMouseLeave={() => setHovered(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        {hoveredSeat && (
          <div className="bt-hover-panel">
            <div className="bt-hover-title">SEAT {padSeat(hoveredSeat.seatId)}</div>
            <div className="bt-hover-divider" />
            {hoveredSeat.price && (
              <div className="bt-hover-row">
                <span className="bt-hover-label">ASK</span>
                <span className="bt-hover-val">{fmtUSDG(hoveredSeat.price)}</span>
              </div>
            )}
            <div className="bt-hover-row">
              <span className="bt-hover-label">STATUS</span>
              <span className={`bt-hover-val${hoveredSeat.status === 'active' ? ' g' : ''}`}>
                {statusLabel(hoveredSeat.status)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bt-legend">
        <div className="bt-legend-item">
          <div className="bt-legend-dot" style={{ background: '#2a5200', border: '1px solid #3a7000' }} />
          SAFE
        </div>
        <div className="bt-legend-item">
          <div className="bt-legend-dot" style={{ background: 'var(--status-warn)', opacity: .7 }} />
          AT RISK
        </div>
        <div className="bt-legend-item">
          <div className="bt-legend-dot" style={{ background: 'var(--status-grace)', opacity: .7 }} />
          GRACE
        </div>
        <div className="bt-legend-item">
          <div className="bt-legend-dot" style={{ background: 'var(--bg3)', border: '1px solid var(--bd0)' }} />
          VACANT
        </div>
      </div>

      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--bd0)' }}>
        <Link href="/board/genesis" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', letterSpacing: '.04em' }}>
          VIEW BOARD →
        </Link>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [stats, setStats] = useState<BoardStats | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [featuredSeat, setFeaturedSeat] = useState<Seat | null>(null)
  const [boardRewards, setBoardRewards] = useState<BoardRewardsData | null>(null)

  useEffect(() => {
    fetch('/api/boards/genesis/seats')
      .then(r => r.json())
      .then((d: { seats: Seat[] }) => {
        const s = d.seats ?? []
        setSeats(s)
        const active = s.filter(x => x.status === 'active' && x.price)
        if (active.length > 0) {
          const sorted = [...active].sort((a, b) => Number(BigInt(b.price!) - BigInt(a.price!)))
          setFeaturedSeat(sorted[0])
        }
      })
      .catch(() => {})

    fetch('/api/boards/genesis')
      .then(r => r.json())
      .then((d: { stats: BoardStats }) => setStats(d.stats ?? null))
      .catch(() => {})

    fetch('/api/activity?limit=200')
      .then(r => r.json())
      .then((d: { activity: ActivityEvent[] }) => setActivity(d.activity ?? []))
      .catch(() => {})

    fetch('/api/boards/genesis/rewards')
      .then(r => r.json())
      .then((d: BoardRewardsData) => setBoardRewards(d))
      .catch(() => {})
  }, [])

  const activeCount = stats?.active ?? 0
  const vacantCount = stats?.vacant ?? 0

  // 7D simulated revenue
  const revenue7d = (() => {
    if (!boardRewards) return 0n
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return boardRewards.recentDeposits
      .filter(d => new Date(d.occurred_at).getTime() > cutoff)
      .reduce((s, d) => s + BigInt(d.amount), 0n)
  })()

  // Per-seat weekly reward estimate (equal distribution)
  const perSeat7d = (() => {
    const n = BigInt(Math.max(1, boardRewards?.activeSeatCount ?? 1))
    return revenue7d / n
  })()

  // 24h takeovers
  const takeovers24h = (() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return activity.filter(ev =>
      ev.event_type === 'SeatTaken' &&
      ev.occurred_at &&
      new Date(ev.occurred_at).getTime() > cutoff
    ).length
  })()

  const medianAsk = (() => {
    const prices = seats.filter(s => s.status === 'active' && s.price).map(s => Number(BigInt(s.price!) / 1_000_000n))
    if (!prices.length) return null
    prices.sort((a, b) => a - b)
    return prices[Math.floor(prices.length / 2)]
  })()

  // Median net carry across active seats
  const medianNetCarry = (() => {
    const active = seats.filter(s => s.status === 'active' && s.weeklyHoldingCost)
    if (!active.length) return null
    const carries = active.map(s => {
      const cost = BigInt(s.weeklyHoldingCost ?? '0')
      return perSeat7d - cost
    })
    carries.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
    return carries[Math.floor(carries.length / 2)]
  })()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', color: 'var(--t1)' }}>

      {/* ── Nav ── */}
      <nav className="l-nav">
        <Link href="/" className="l-logo">BOARD</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ color: 'var(--green)', fontSize: 8, marginRight: 4 }}>●</span>
          <Link href="/board/genesis"        className="l-nav-link first">BOARD</Link>
          <Link href="/activity"    className="l-nav-link">ACTIVITY</Link>
          <Link href="/rewards"     className="l-nav-link">REWARDS</Link>
          <Link href="/leaderboard" className="l-nav-link">LEADERBOARD</Link>
          <Link href="/about"       className="l-nav-link">ABOUT</Link>
        </div>
        <Link href="/board/genesis" className="l-nav-enter">ENTER BOARD →</Link>
      </nav>

      {/* ── Hero ── */}
      <div className="l-hero">

        {/* Left */}
        <div className="hero-left">
          <div className="l-hero-badge">
            <span className="badge-dot" />
            <span>LIVE</span>
            <span className="badge-sep">·</span>
            <span>BOARD #001 / GENESIS</span>
          </div>

          <h1 className="hero-h">
            OWN YOUR SEAT.<br />
            NAME YOUR PRICE.<br />
            <span className="accent">ANYONE CAN TAKE IT.</span>
          </h1>

          <p className="hero-sub">
            100 scarce positions backed by productive onchain markets.
            Earn while you hold it.
          </p>

          <div className="hero-cta-row">
            <Link href="/board/genesis" className="cta-primary">ENTER BOARD →</Link>
            <a href="#how" className="cta-secondary">HOW IT WORKS ▷</a>
          </div>

          <div className="social-proof">
            <div className="sp-line">
              <span className="sp-num g">{activeCount}</span>
              <span>seats currently occupied</span>
            </div>
            <div className="sp-line">
              <span className="sp-num">{vacantCount}</span>
              <span>seats available — $10 to take</span>
            </div>
            {medianAsk !== null && (
              <div className="sp-line">
                <span className="sp-num">${medianAsk}</span>
                <span>median ask price</span>
              </div>
            )}
          </div>
        </div>

        {/* Right — Board terminal */}
        <div className="hero-right">
          <BoardTerminal seats={seats} />
        </div>
      </div>

      {/* ── Metrics strip ── */}
      <div className="l-metrics">
        <div className="l-metric">
          <div className="l-metric-label">7D SIM REVENUE <span style={{ color: 'var(--status-warn)', fontSize: 8 }}>SIMULATED</span></div>
          <div className="l-metric-val g">{revenue7d > 0n ? fmtUSDG(String(revenue7d)) : '—'}</div>
          <div className="l-metric-bottom">
            <span className="l-metric-change">last 7 days · testnet</span>
            {revenue7d > 0n && <SparkLine />}
          </div>
        </div>
        <div className="l-metric">
          <div className="l-metric-label">ACTIVE SEATS</div>
          <div className="l-metric-val g">{activeCount} / 100</div>
          <div className="l-metric-bottom">
            <span className="l-metric-change">{vacantCount} vacant · $10 to take</span>
          </div>
        </div>
        <div className="l-metric">
          <div className="l-metric-label">24H TAKEOVERS</div>
          <div className="l-metric-val">{takeovers24h}</div>
          <div className="l-metric-bottom">
            <span className="l-metric-change">last 24 hours</span>
          </div>
        </div>
        <div className="l-metric">
          <div className="l-metric-label">MEDIAN ASK</div>
          <div className="l-metric-val">{medianAsk !== null ? `$${medianAsk}` : '—'}</div>
          <div className="l-metric-bottom">
            <span className="l-metric-change">active seats</span>
            {medianAsk !== null && <SparkLine />}
          </div>
        </div>
        <div className="l-metric">
          <div className="l-metric-label">MEDIAN NET CARRY</div>
          <div className={`l-metric-val${medianNetCarry !== null && medianNetCarry >= 0n ? ' g' : ' r'}`}>
            {medianNetCarry !== null
              ? `${medianNetCarry >= 0n ? '+' : '-'}${fmtUSDG(medianNetCarry >= 0n ? medianNetCarry : -medianNetCarry)}`
              : '—'}
          </div>
          <div className="l-metric-bottom">
            <span className="l-metric-change">per seat · per week</span>
          </div>
        </div>
      </div>

      {/* ── How Board Works ── */}
      <div id="how" className="l-how">
        <div className="l-how-title">HOW BOARD WORKS</div>
        <div className="l-how-grid">
          <div className="l-how-step">
            <div className="l-how-step-num">01</div>
            <div className="l-how-step-icon">◻</div>
            <div className="l-how-step-title">TAKE A SEAT</div>
            <p className="l-how-step-text">Pay $10 to claim a vacant seat — or pay any owner&apos;s ask price to take theirs.</p>
            <div className="l-how-arrow">→</div>
          </div>
          <div className="l-how-step">
            <div className="l-how-step-num">02</div>
            <div className="l-how-step-icon">⬡</div>
            <div className="l-how-step-title">SET YOUR PRICE</div>
            <p className="l-how-step-text">Name your ask. Higher ask = harder to take, but also higher weekly holding cost.</p>
            <div className="l-how-arrow">→</div>
          </div>
          <div className="l-how-step">
            <div className="l-how-step-num">03</div>
            <div className="l-how-step-icon">▣</div>
            <div className="l-how-step-title">FUND YOUR HOLD</div>
            <p className="l-how-step-text">Prepay holding costs to stay active. Let it run dry and your seat enters grace.</p>
            <div className="l-how-arrow">→</div>
          </div>
          <div className="l-how-step">
            <div className="l-how-step-num">04</div>
            <div className="l-how-step-icon">◎</div>
            <div className="l-how-step-title">EARN WHILE YOU HOLD</div>
            <p className="l-how-step-text">Active seats earn a pro-rata share of the board&apos;s productive revenue every cycle.</p>
            <div className="l-how-arrow">→</div>
          </div>
          <div className="l-how-step">
            <div className="l-how-step-num">05</div>
            <div className="l-how-step-icon">⊕</div>
            <div className="l-how-step-title">DEFEND YOUR SEAT</div>
            <p className="l-how-step-text">Anyone can take your seat at any time. Reprice, top up, or let them have it.</p>
          </div>
        </div>
        <div className="l-how-footer">
          <p className="l-how-footer-line">Take. Price. Fund. Earn. Defend. Repeat.</p>
          <p className="l-how-footer-cta">The last holder standing wins the most.</p>
        </div>
      </div>

      {/* ── Lower panels ── */}
      <div className="l-lower">

        {/* Live activity */}
        <div className="l-lower-panel">
          <div className="l-panel-label">
            LIVE ACTIVITY
            <Link href="/activity" className="l-panel-link">VIEW ALL</Link>
          </div>
          {activity.length === 0 ? (
            <div className="empty-state">No recent activity</div>
          ) : (
            <div className="act-tape">
              {activity.slice(0, 8).map((ev, i) => {
                const label = eventLabel(ev.event_type)
                const EV_CLASS: Record<string, string> = {
                  'ACQUIRED': 'ev-acquired', 'TAKEOVER': 'ev-takeover',
                  'REPRICED': 'ev-repriced', 'TOPPED UP': 'ev-toppedup', 'FORECLOSED': 'ev-foreclosed',
                }
                const val = ev.event_type === 'SeatPriceChanged' && ev.previous_price && ev.new_price
                  ? `${fmtUSDG(ev.previous_price)} → ${fmtUSDG(ev.new_price)}`
                  : ev.amount ? fmtUSDG(ev.amount) : ev.new_price ? fmtUSDG(ev.new_price) : '—'
                return (
                  <div key={i} className="act-tape-row">
                    <span className="att-time">{fmtTime(ev.occurred_at)}</span>
                    <span className="att-seat">{padSeat(ev.seat_id)}</span>
                    <span className={`att-event ${EV_CLASS[label] ?? ''}`}>{label}</span>
                    <span className="att-amt">{val}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Featured seat */}
        <div className="l-lower-panel" style={{ padding: 0 }}>
          <div className="l-panel-label" style={{ padding: '0 28px', height: 40, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--bd0)' }}>
            FEATURED SEAT
            {featuredSeat && (
              <Link href="/board/genesis" className="l-panel-link">VIEW SEAT →</Link>
            )}
          </div>
          {featuredSeat ? (
            <div className="l-feat-lower">
              {/* Art */}
              <div className="l-feat-art-col">
                <ConcentricArt seatId={featuredSeat.seatId} />
              </div>
              {/* Data */}
              {(() => {
                const ask = BigInt(featuredSeat.price ?? '0')
                const holdingCost = weeklyFee(ask)
                const featCarry = perSeat7d - holdingCost
                return (
                  <div className="l-feat-data-col">
                    <div className="l-feat-name-row">
                      <span className="l-feat-name">SEAT {padSeat(featuredSeat.seatId)}</span>
                      <span className="l-feat-sbadge safe">ACTIVE</span>
                    </div>
                    <div>
                      <div className="l-feat-flabel">ASK</div>
                      <div className="l-feat-fval">{fmtUSDG(ask)}</div>
                    </div>
                    <div>
                      <div className="l-feat-flabel">7D SIM REWARDS <span style={{ fontSize: 8, color: 'var(--status-warn)' }}>SIMULATED</span></div>
                      <div className="l-feat-fval g" style={{ fontSize: 18 }}>{fmtUSDG(perSeat7d)}</div>
                    </div>
                    <div>
                      <div className="l-feat-flabel">HOLDING COST</div>
                      <div className="l-feat-fval" style={{ fontSize: 16, color: 'var(--t2)' }}>
                        {fmtUSDG(holdingCost)}<span style={{ fontSize: 11, color: 'var(--t4)' }}>/wk</span>
                      </div>
                    </div>
                    <div>
                      <div className="l-feat-flabel">NET CARRY</div>
                      <div className={`l-feat-fval${featCarry >= 0n ? ' g' : ''}`} style={{ fontSize: 16, color: featCarry < 0n ? 'var(--red)' : undefined }}>
                        {featCarry >= 0n ? '+' : '-'}{fmtUSDG(featCarry >= 0n ? featCarry : -featCarry)}
                        <span style={{ fontSize: 11, color: 'var(--t4)' }}>/wk</span>
                      </div>
                    </div>
                    <Link href="/board/genesis" className="l-view-seat-btn">
                      VIEW SEAT <span>→</span>
                    </Link>
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="l-feat-lower" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <div className="empty-state" style={{ padding: 0 }}>
                {activeCount === 0 ? 'No active seats yet' : 'Loading...'}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="l-footer3">
        <div>
          <div className="l-footer-logo">BOARD</div>
          <div className="l-footer-tagline">© 2025 BOARD Labs</div>
        </div>
        <div className="l-footer3-center">
          <div className="l-footer3-cline">SCARCE POSITIONS. REAL YIELD.</div>
          <div className="l-footer3-gline">OWN YOUR SEAT.</div>
        </div>
        <div className="l-footer3-social">
          <a href="#" aria-label="X (Twitter)">✕</a>
          <a href="#" aria-label="Discord">◈</a>
          <a href="/genesis" aria-label="Genesis">⊟</a>
          <a href="/about" aria-label="About">◎</a>
        </div>
      </div>

    </div>
  )
}
