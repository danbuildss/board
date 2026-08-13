'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmtTimestamp, padSeat, eventLabel, fmtUSDG } from '@/lib/format'

type ActivityEvent = {
  event_type: string
  seat_id: number
  tx_hash: string
  actor: string | null
  amount: string | null
  new_price: string | null
  previous_price: string | null
  occurred_at: string | null
}

const FILTERS = ['ALL', 'ACQUIRED', 'TAKEOVER', 'REPRICED', 'TOPPED UP', 'FORECLOSED']

const EV_CLASS: Record<string, string> = {
  'ACQUIRED':   'ev-acquired',
  'TAKEOVER':   'ev-takeover',
  'REPRICED':   'ev-repriced',
  'TOPPED UP':  'ev-toppedup',
  'FORECLOSED': 'ev-foreclosed',
}

function fmtAmt(ev: ActivityEvent): string {
  if (ev.event_type === 'SeatPriceChanged' && ev.previous_price && ev.new_price) {
    return `${fmtUSDG(ev.previous_price)} → ${fmtUSDG(ev.new_price)}`
  }
  if (ev.amount) return fmtUSDG(ev.amount)
  if (ev.new_price) return fmtUSDG(ev.new_price)
  return '—'
}

export default function ActivityPage() {
  const [filter, setFilter] = useState('ALL')

  const { data, isLoading } = useQuery<{ activity: ActivityEvent[] }>({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/activity?limit=200').then(r => r.json()),
    refetchInterval: 15_000,
  })

  const all = data?.activity ?? []
  const events = filter === 'ALL'
    ? all
    : all.filter(e => eventLabel(e.event_type) === filter)

  return (
    <div className="page-scroll">
      <div className="act-wrap">
        <div className="act-filters">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`fpill${filter === f ? ' on' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : events.length === 0 ? (
          <div className="empty-state">No events yet</div>
        ) : (
          <div className="act-tape">
            <div className="act-tape-hdr">
              <span>TIME</span>
              <span>SEAT</span>
              <span>EVENT</span>
              <span>AMOUNT</span>
            </div>
            {events.map((ev, i) => {
              const label = eventLabel(ev.event_type)
              return (
                <div key={i} className="act-tape-row">
                  <span className="att-time">{fmtTimestamp(ev.occurred_at)}</span>
                  <span className="att-seat">{padSeat(ev.seat_id)}</span>
                  <span className={`att-event ${EV_CLASS[label] ?? ''}`}>{label}</span>
                  <span className="att-amt">{fmtAmt(ev)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
