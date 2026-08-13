'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmtUSDG, padSeat } from '@/lib/format'

type Seat = { seatId: number; status: string; price?: string }
type BoardStats = {
  active: number
  vacant: number
  grace: number
  foreclosable: number
}

function MiniGrid({ seats }: { seats: Seat[] }) {
  const grid: Seat[] = Array.from({ length: 100 }, (_, i) => {
    const id = i + 1
    return seats.find(s => s.seatId === id) ?? { seatId: id, status: 'vacant' }
  })
  return (
    <div className="fbc-mini-grid">
      {grid.map(s => (
        <div key={s.seatId} className={`fbc-mini-seat ${s.status.toLowerCase()}`} />
      ))}
    </div>
  )
}

const UPCOMING = [
  {
    num: '#002',
    name: 'TSLA',
    sub: 'Tesla Board',
    badge: 'upcoming',
    tags: ['EV', 'MEME', 'VOLATILE'],
    seats: 100,
    price: '$10',
    rate: '0.5%/wk',
    chain: 'TBD',
  },
  {
    num: '#003',
    name: 'AAPL',
    sub: 'Apple Board',
    badge: 'upcoming',
    tags: ['TECH', 'LARGE-CAP'],
    seats: 100,
    price: '$25',
    rate: '0.5%/wk',
    chain: 'TBD',
  },
  {
    num: '#004',
    name: 'AMZN',
    sub: 'Amazon Board',
    badge: 'researching',
    tags: ['TECH', 'COMMERCE', 'CLOUD'],
    seats: 100,
    price: 'TBD',
    rate: '0.5%/wk',
    chain: 'TBD',
  },
]

export default function BoardsPage() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [stats, setStats] = useState<BoardStats | null>(null)

  useEffect(() => {
    fetch('/api/boards/hood/seats')
      .then(r => r.json())
      .then((d: { seats: Seat[] }) => setSeats(d.seats ?? []))
      .catch(() => {})
    fetch('/api/boards/hood')
      .then(r => r.json())
      .then((d: { stats: BoardStats }) => setStats(d.stats))
      .catch(() => {})
  }, [])

  const highestAsk = seats.reduce((max, s) => {
    if (!s.price) return max
    const p = BigInt(s.price)
    return p > max ? p : max
  }, 0n)

  const totalActive = stats?.active ?? 0
  const totalVacant = stats?.vacant ?? 0

  return (
    <div className="boards-page">
      <div className="boards-inner">

        {/* Hero */}
        <div className="boards-hero">
          <div className="boards-hero-left">
            <div className="boards-eyebrow">BOARD MARKETPLACE</div>
            <h1 className="boards-hero-h">
              Contestable Ownership<br />
              <span className="accent">on Any Market.</span>
            </h1>
            <p className="boards-hero-sub">
              Each Board is a 100-seat arena built around a productive on-chain position.
              Take a seat, name your price, pay to hold it.
            </p>
          </div>
          <div className="boards-hero-stats">
            <div className="boards-hero-stat">
              <div className="boards-hero-stat-label">LIVE BOARDS</div>
              <div className="boards-hero-stat-val g">1</div>
              <div className="boards-hero-stat-sub">HOOD</div>
            </div>
            <div className="boards-hero-stat">
              <div className="boards-hero-stat-label">COMING SOON</div>
              <div className="boards-hero-stat-val">3</div>
              <div className="boards-hero-stat-sub">announced</div>
            </div>
            <div className="boards-hero-stat">
              <div className="boards-hero-stat-label">ACTIVE SEATS</div>
              <div className="boards-hero-stat-val g">{totalActive}</div>
              <div className="boards-hero-stat-sub">occupied now</div>
            </div>
            <div className="boards-hero-stat">
              <div className="boards-hero-stat-label">VACANT</div>
              <div className="boards-hero-stat-val">{totalVacant}</div>
              <div className="boards-hero-stat-sub">open to take</div>
            </div>
          </div>
        </div>

        {/* Featured board — HOOD */}
        <div className="featured-board-card">
          {/* Art panel */}
          <div className="fbc-art">
            <div style={{ padding: 16, width: '100%' }}>
              {seats.length > 0 ? <MiniGrid seats={seats} /> : (
                <div style={{ color: 'var(--t4)', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  LOADING...
                </div>
              )}
            </div>
          </div>

          {/* Main panel */}
          <div className="fbc-main">
            <div className="fbc-id-row">
              <span className="fbc-board-id">BOARD #001</span>
              <span className="fbc-badge genesis">GENESIS</span>
              <span className="fbc-badge live">LIVE</span>
            </div>
            <div>
              <div className="fbc-name">HOOD</div>
              <div className="fbc-name-sub">Robinhood Chain · Testnet</div>
            </div>
            <div className="fbc-tags">
              <span className="fbc-tag">HARBERGER</span>
              <span className="fbc-tag">100 SEATS</span>
              <span className="fbc-tag">TESTNET</span>
            </div>
            <p className="fbc-desc">
              The genesis BOARD. 100 seats, self-assessed prices, 0.5% weekly holding cost.
              Anyone can take any seat at the owner's asking price. Sellers receive 95%.
              Productive positions earn rewards distributed to active seat holders.
            </p>
            <div className="fbc-metrics">
              <div className="fbc-metric">
                <div className="fbc-metric-label">SEATS</div>
                <div className="fbc-metric-val">100</div>
              </div>
              <div className="fbc-metric">
                <div className="fbc-metric-label">ACTIVE</div>
                <div className="fbc-metric-val g">{totalActive}</div>
              </div>
              <div className="fbc-metric">
                <div className="fbc-metric-label">VACANT PRICE</div>
                <div className="fbc-metric-val">$10</div>
              </div>
              <div className="fbc-metric">
                <div className="fbc-metric-label">HOLD RATE</div>
                <div className="fbc-metric-val">0.5%/wk</div>
              </div>
              <div className="fbc-metric">
                <div className="fbc-metric-label">HIGHEST ASK</div>
                <div className="fbc-metric-val g">{highestAsk > 0n ? fmtUSDG(String(highestAsk)) : '—'}</div>
              </div>
            </div>
            <Link href="/hood" className="fbc-enter-btn">Enter HOOD Board →</Link>
          </div>

          {/* Right panel */}
          <div className="fbc-right">
            <div className="fbc-right-label">LIVE STATE</div>
            {seats.length > 0 && <MiniGrid seats={seats} />}
            <div className="fbc-legend">
              <div className="fbc-legend-item">
                <div className="fbc-legend-dot" style={{ background: 'var(--green-d)' }} />
                ACTIVE
              </div>
              <div className="fbc-legend-item">
                <div className="fbc-legend-dot" style={{ background: 'var(--bg4)', border: '1px solid var(--bd0)' }} />
                VACANT
              </div>
              <div className="fbc-legend-item">
                <div className="fbc-legend-dot" style={{ background: 'var(--status-grace)' }} />
                GRACE
              </div>
              <div className="fbc-legend-item">
                <div className="fbc-legend-dot" style={{ background: 'var(--red)' }} />
                FORE
              </div>
            </div>
            <div className="fbc-stat-grid">
              <div className="fbc-stat-row">
                <span className="fbc-stat-label">GRACE</span>
                <span className="fbc-stat-val">{stats?.grace ?? 0}</span>
              </div>
              <div className="fbc-stat-row">
                <span className="fbc-stat-label">FORECLOSABLE</span>
                <span className="fbc-stat-val">{stats?.foreclosable ?? 0}</span>
              </div>
              <div className="fbc-stat-row">
                <span className="fbc-stat-label">NETWORK</span>
                <span className="fbc-stat-val" style={{ fontSize: 10, color: 'var(--t3)' }}>HOOD CHAIN 46630</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming boards */}
        <div className="upcoming-section">
          <div className="upcoming-label">UPCOMING BOARDS</div>
          <div className="upcoming-grid">
            {UPCOMING.map(board => (
              <div key={board.num} className="upcoming-card">
                <div className="uc-status">
                  <span className="uc-num">{board.num}</span>
                  <span className={`uc-badge ${board.badge}`}>{board.badge.toUpperCase()}</span>
                </div>
                <div className="uc-art">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 900, color: 'var(--bd2)', letterSpacing: '-.02em' }}>
                    {board.name}
                  </span>
                </div>
                <div>
                  <div className="uc-name">{board.name}</div>
                  <div className="uc-sub">{board.sub}</div>
                </div>
                <div className="uc-tags">
                  {board.tags.map(t => (
                    <span key={t} className="uc-tag">{t}</span>
                  ))}
                </div>
                <div className="uc-meta-grid">
                  <div className="uc-meta">
                    <div className="uc-meta-label">SEATS</div>
                    <div className="uc-meta-val">{board.seats}</div>
                  </div>
                  <div className="uc-meta">
                    <div className="uc-meta-label">START PRICE</div>
                    <div className="uc-meta-val">{board.price}</div>
                  </div>
                  <div className="uc-meta">
                    <div className="uc-meta-label">RATE</div>
                    <div className="uc-meta-val">{board.rate}</div>
                  </div>
                  <div className="uc-meta">
                    <div className="uc-meta-label">CHAIN</div>
                    <div className="uc-meta-val">{board.chain}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
