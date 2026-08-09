'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fmtTimestamp, fmtAddr, padSeat, eventLabel, fmtUSDG } from '@/lib/format'

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
  'TAKEOVER':   'ev-taken',
  'REPRICED':   'ev-repriced',
  'TOPPED UP':  'ev-toppedup',
  'FORECLOSED': 'ev-foreclosed',
}

export default function ActivityPage() {
  const [filter, setFilter] = useState('ALL')

  const { data, isLoading } = useQuery<{ activity: ActivityEvent[] }>({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/activity?limit=100').then(r => r.json()),
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
          <div className="act-table">
            <div className="act-head">
              <span>EVENT</span>
              <span>SEAT</span>
              <span>ACTOR</span>
              <span>AMOUNT</span>
              <span style={{ textAlign: 'right' }}>TIME</span>
            </div>
            {events.map((ev, i) => {
              const label = eventLabel(ev.event_type)
              const amt = ev.amount
                ? fmtUSDG(ev.amount)
                : ev.new_price
                ? fmtUSDG(ev.new_price)
                : '—'
              return (
                <div key={i} className="act-row">
                  <span>
                    <span className={`ev-pill ${EV_CLASS[label] ?? ''}`}>{label}</span>
                  </span>
                  <span className="act-seat">{padSeat(ev.seat_id)}</span>
                  <span className="act-actor">{ev.actor ? fmtAddr(ev.actor) : '—'}</span>
                  <span className="act-amt">{amt}</span>
                  <span className="act-time">{fmtTimestamp(ev.occurred_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
