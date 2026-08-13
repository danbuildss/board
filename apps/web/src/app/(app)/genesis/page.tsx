'use client'

import { useQuery } from '@tanstack/react-query'
import { fmtUSDG, padSeat, eventLabel, fmtDate } from '@/lib/format'

type BoardData = {
  stats: {
    active: number
    vacant: number
    grace: number
    foreclosable: number
  }
  board?: {
    name: string
    seatCount: number
    vacantPrice: string
    holdingRateBps: number
    gracePeriod: number
  }
}

type ActivityEvent = {
  event_type: string
  seat_id: number
  new_price: string | null
  amount: string | null
  occurred_at: string | null
  tx_hash: string | null
}

export default function GenesisPage() {
  const { data: boardData } = useQuery<BoardData>({
    queryKey: ['board-genesis'],
    queryFn: () => fetch('/api/boards/hood').then(r => r.json()),
  })

  const { data: activityData } = useQuery<{ activity: ActivityEvent[] }>({
    queryKey: ['activity-all'],
    queryFn: () => fetch('/api/activity?limit=200').then(r => r.json()),
    refetchInterval: 30_000,
  })

  const stats = boardData?.stats
  const events = activityData?.activity ?? []

  return (
    <div className="page-scroll">
      <div className="page-inner gn-page">

        <div className="gn-header">
          <div className="gn-title">GENESIS</div>
          <div className="gn-sub">HOOD Board · Onchain record</div>
        </div>

        {/* Board parameters */}
        <div className="gn-section">
          <div className="gn-section-label">BOARD PARAMETERS</div>
          <div className="gn-param-grid">
            <div className="gn-param">
              <div className="gn-param-label">SEATS</div>
              <div className="gn-param-val">100</div>
            </div>
            <div className="gn-param">
              <div className="gn-param-label">VACANT PRICE</div>
              <div className="gn-param-val">$10.00</div>
            </div>
            <div className="gn-param">
              <div className="gn-param-label">HOLDING RATE</div>
              <div className="gn-param-val">0.5% / wk</div>
            </div>
            <div className="gn-param">
              <div className="gn-param-label">GRACE PERIOD</div>
              <div className="gn-param-val">72 h</div>
            </div>
            <div className="gn-param">
              <div className="gn-param-label">SELLER SHARE</div>
              <div className="gn-param-val">95%</div>
            </div>
            <div className="gn-param">
              <div className="gn-param-label">PROTOCOL FEE</div>
              <div className="gn-param-val">5%</div>
            </div>
          </div>
        </div>

        {/* Live state */}
        {stats && (
          <div className="gn-section">
            <div className="gn-section-label">LIVE STATE</div>
            <div className="gn-param-grid">
              <div className="gn-param">
                <div className="gn-param-label">ACTIVE</div>
                <div className="gn-param-val g">{stats.active}</div>
              </div>
              <div className="gn-param">
                <div className="gn-param-label">VACANT</div>
                <div className="gn-param-val dim">{stats.vacant}</div>
              </div>
              <div className="gn-param">
                <div className="gn-param-label">GRACE</div>
                <div className="gn-param-val a">{stats.grace}</div>
              </div>
              <div className="gn-param">
                <div className="gn-param-label">FORECLOSABLE</div>
                <div className="gn-param-val r">{stats.foreclosable}</div>
              </div>
            </div>
          </div>
        )}

        {/* Contract addresses */}
        <div className="gn-section">
          <div className="gn-section-label">CONTRACTS · ROBINHOOD CHAIN TESTNET (46630)</div>
          <div className="gn-addr-list">
            <div className="gn-addr-row">
              <span className="gn-addr-label">BOARD</span>
              <span className="gn-addr-val">0x6A57Ff5C1d105941c8A6CcCC681F37B1FED9733E</span>
            </div>
            <div className="gn-addr-row">
              <span className="gn-addr-label">REWARD ACCOUNTING</span>
              <span className="gn-addr-val">0xf51FAACD5a76Bf315a9473FcE549a49B2fe3cb78</span>
            </div>
            <div className="gn-addr-row">
              <span className="gn-addr-label">BOARD VAULT</span>
              <span className="gn-addr-val">0xf3751c59f4D90B3F117560Fc61c7968D8e1C4648</span>
            </div>
            <div className="gn-addr-row">
              <span className="gn-addr-label">REGISTRY</span>
              <span className="gn-addr-val">0x65fae2658BB7391E57290cb055E1448E3aa76cF6</span>
            </div>
            <div className="gn-addr-row">
              <span className="gn-addr-label">SETTLEMENT (USDG)</span>
              <span className="gn-addr-val">0x7E955252E15c84f5768B83c41a71F9eba181802F</span>
            </div>
          </div>
        </div>

        {/* Full event log */}
        <div className="gn-section">
          <div className="gn-section-label">EVENT LOG ({events.length} events)</div>
          {events.length === 0 ? (
            <div className="empty-state dim">No events indexed</div>
          ) : (
            <div className="gn-event-list">
              <div className="gn-event-hdr">
                <span>TIME</span>
                <span>SEAT</span>
                <span>EVENT</span>
                <span>AMOUNT</span>
              </div>
              {[...events].reverse().map((ev, i) => (
                <div key={i} className="gn-event-row">
                  <span className="dim">{fmtDate(ev.occurred_at)}</span>
                  <span className="gn-seat-id">{padSeat(ev.seat_id)}</span>
                  <span className="gn-event-type">{eventLabel(ev.event_type)}</span>
                  <span className="dim">
                    {ev.amount ? fmtUSDG(ev.amount) : ev.new_price ? fmtUSDG(ev.new_price) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
