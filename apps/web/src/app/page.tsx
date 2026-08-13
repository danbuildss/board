'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Seat = { seatId: number; status: string }

function LiveGrid() {
  const [seats, setSeats] = useState<Seat[]>([])

  useEffect(() => {
    fetch('/api/boards/hood/seats')
      .then(r => r.json())
      .then((d: { seats: Seat[] }) => setSeats(d.seats ?? []))
      .catch(() => {})
  }, [])

  const grid: Seat[] = Array.from({ length: 100 }, (_, i) => {
    const id = i + 1
    return seats.find(s => s.seatId === id) ?? { seatId: id, status: 'vacant' }
  })

  return (
    <div className="mini-grid-wrap">
      <div className="mini-grid">
        {grid.map(s => (
          <div key={s.seatId} className={`mdot ${s.status.toLowerCase()}`} />
        ))}
      </div>
      <div className="mini-legend">
        <div className="ml-item">
          <div className="ml-dot" style={{ background: 'var(--green)' }} />
          ACTIVE
        </div>
        <div className="ml-item">
          <div className="ml-dot" style={{ background: 'var(--s3)' }} />
          VACANT
        </div>
        <div className="ml-item">
          <div className="ml-dot" style={{ background: 'var(--amber)' }} />
          GRACE
        </div>
        <div className="ml-item">
          <div className="ml-dot" style={{ background: 'var(--red)' }} />
          FORECLOSE
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="l-nav">
        <span className="l-logo">BOARD</span>
        <span className="l-chain">HOOD CHAIN TESTNET</span>
        <Link href="/hood" className="l-enter-btn">Enter Board →</Link>
      </nav>

      <div className="l-hero">
        <div className="hero-left">
          <p className="hero-eye">HOOD BOARD — 100 SEATS</p>
          <h1 className="hero-h">
            Own a seat.<br />
            <span className="g">Hold your ground.</span>
          </h1>
          <p className="hero-sub">
            100 Seats on a public board. Anyone can take any seat — for a price.
            Self-assess what yours is worth. Pay to hold it. Lose it if you don&apos;t.
          </p>
          <div className="hero-stats">
            <div className="h-stat">
              <span className="h-sv">100</span>
              <span className="h-sl">Seats</span>
            </div>
            <div className="h-stat">
              <span className="h-sv">0.5%</span>
              <span className="h-sl">Weekly Rate</span>
            </div>
            <div className="h-stat">
              <span className="h-sv">72h</span>
              <span className="h-sl">Grace Period</span>
            </div>
          </div>
          <Link href="/hood" className="cta-btn">Enter the Board →</Link>
        </div>

        <div className="hero-right">
          <LiveGrid />
        </div>
      </div>

      <div className="how-strip">
        <div className="how-item">
          <span className="how-num">01</span>
          <span className="how-title">Take a Seat</span>
          <p className="how-text">Set your price. Put down a deposit. The seat is yours.</p>
        </div>
        <div className="how-item">
          <span className="how-num">02</span>
          <span className="how-title">Pay to Hold</span>
          <p className="how-text">0.5% weekly holding cost. Top up to keep your seat.</p>
        </div>
        <div className="how-item">
          <span className="how-num">03</span>
          <span className="how-title">Get Taken Over</span>
          <p className="how-text">Anyone can pay your price and take your seat. You get 95%.</p>
        </div>
        <div className="how-item">
          <span className="how-num">04</span>
          <span className="how-title">Or Take Others</span>
          <p className="how-text">Pay the asking price, set your own. Repeat indefinitely.</p>
        </div>
      </div>

      <div className="l-footer">
        <div>
          <div className="l-footer-logo">BOARD</div>
          <div className="l-footer-sub">Harberger seat ownership on-chain</div>
        </div>
        <div className="l-footer-right">TESTNET · CHAIN 46630</div>
      </div>
    </div>
  )
}
