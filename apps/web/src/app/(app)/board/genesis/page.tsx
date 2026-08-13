'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { writeContract, waitForTransactionReceipt, readContract } from 'wagmi/actions'
import { wagmiConfig, BOARD_ADDRESS, USDG_ADDRESS, robinhoodTestnet } from '@/lib/config'
import { BOARD_ABI, ERC20_ABI } from '@/lib/abi'
import {
  fmtUSDG, fmtAddr, padSeat, minDeposit, weeklyFee, weeksRemaining,
  fmtDate, eventLabel, parseUSDG,
} from '@/lib/format'

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

type HistoryEvent = {
  event_type: string
  tx_hash: string
  amount: string | null
  new_price: string | null
  previous_price: string | null
  occurred_at: string | null
}

type SeatDetail = Seat & { history: HistoryEvent[] }

type BoardRewardDeposit = { amount: string; occurred_at: string }
type BoardRewards = {
  activeSeatCount: number
  recentDeposits: BoardRewardDeposit[]
}

type ModalKind = 'take' | 'reprice' | 'topup' | 'takeover' | 'foreclose'
type TxStep = 'form' | 'approving' | 'confirming' | 'done' | 'error'

const VACANT_PRICE_RAW = 10_000_000n

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

function ConcentricArt({ seatId }: { seatId: number }) {
  const layers = [
    { size: 56, color: '#1a2a00' },
    { size: 44, color: '#2a4400' },
    { size: 32, color: '#3a6000' },
    { size: 22, color: '#5a9000' },
    { size: 13, color: '#8acc00' },
  ]
  return (
    <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {layers.map((l, i) => (
        <div key={i} style={{ position: 'absolute', width: l.size, height: l.size, border: `1px solid ${l.color}` }} />
      ))}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--green)', fontWeight: 700, zIndex: 1, letterSpacing: '.06em' }}>
        {padSeat(seatId)}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: Seat['status'] }) {
  const labels: Record<string, string> = {
    VACANT: 'VACANT', ACTIVE: 'ACTIVE', GRACE: 'GRACE', FORECLOSABLE: 'FORECLOSABLE',
  }
  return (
    <span className={`sbadge ${status.toLowerCase()}`}>
      <span className="sdot" />
      {labels[status]}
    </span>
  )
}

function balClass(seat: Seat): string {
  if (!seat.price || seat.price === '0') return 'g'
  const w = parseFloat(weeksRemaining(BigInt(seat.effectiveBalance), BigInt(seat.price)))
  if (w > 4) return 'g'
  if (w > 2) return 'a'
  return 'r'
}

function balWidth(seat: Seat): number {
  if (!seat.price || seat.price === '0' || seat.weeklyHoldingCost === '0') return 0
  const bal = +seat.effectiveBalance
  const weekly = +seat.weeklyHoldingCost
  const weeks = bal / weekly
  return Math.min(100, Math.max(0, (weeks / 10) * 100))
}

export default function HoodPage() {
  const { address } = useAccount()
  const qc = useQueryClient()

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

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tooltipSeat, setTooltipSeat] = useState<Seat | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const selectedSeat = seats.find(s => s.seatId === selectedId) ?? null

  const { data: detailData } = useQuery<SeatDetail>({
    queryKey: ['seat-detail', selectedId],
    queryFn: () => fetch(`/api/boards/genesis/seats/${selectedId}`).then(r => r.json()),
    enabled: selectedId !== null,
  })

  const { data: rewardsData } = useQuery<{ cumulativeBanked: string }>({
    queryKey: ['seat-rewards', selectedId],
    queryFn: () => fetch(`/api/boards/genesis/seats/${selectedId}/rewards`).then(r => r.json()),
    enabled: selectedId !== null,
  })

  const { data: boardRewards } = useQuery<BoardRewards>({
    queryKey: ['board-rewards-summary'],
    queryFn: () => fetch('/api/boards/genesis/rewards').then(r => r.json()),
    refetchInterval: 60_000,
  })

  const [modal, setModal] = useState<ModalKind | null>(null)
  const [txStep, setTxStep] = useState<TxStep>('form')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [newPrice, setNewPrice] = useState('10')
  const [prepaid, setPrepaid] = useState('0.50')
  const [topupAmt, setTopupAmt] = useState('1.00')

  const isMine = (seat: Seat | null) =>
    !!seat?.owner && !!address && seat.owner.toLowerCase() === address.toLowerCase()

  function openModal(kind: ModalKind, seat: Seat) {
    setModal(kind)
    setTxStep('form')
    setTxHash(null)
    setTxError(null)
    if (kind === 'take') {
      setNewPrice('10')
      setPrepaid((Number(minDeposit(VACANT_PRICE_RAW)) / 1_000_000).toFixed(2))
    } else if (kind === 'topup' && seat.weeklyHoldingCost) {
      const weekly = BigInt(seat.weeklyHoldingCost)
      const amt = weekly > 0n ? Math.max(Number(weekly * 4n) / 1_000_000, 0.5) : 1
      setTopupAmt(amt.toFixed(2))
    } else if (kind === 'takeover' && seat.price) {
      const dep = minDeposit(BigInt(seat.price))
      setPrepaid((Number(dep) / 1_000_000).toFixed(2))
      setNewPrice((Number(seat.price) / 1_000_000).toFixed(0))
    } else if (kind === 'reprice' && seat.price) {
      setNewPrice((Number(seat.price) / 1_000_000).toFixed(0))
    }
  }

  function closeModal() {
    if (txStep === 'approving' || txStep === 'confirming') return
    setModal(null)
  }

  async function ensureAllowance(needed: bigint) {
    if (!address) throw new Error('Not connected')
    const allowance = await readContract(wagmiConfig, {
      address: USDG_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address, BOARD_ADDRESS],
    })
    if ((allowance as bigint) >= needed) return
    setTxStep('approving')
    const hash = await writeContract(wagmiConfig, {
      address: USDG_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [BOARD_ADDRESS, needed],
      chain: robinhoodTestnet,
      account: address,
    })
    await waitForTransactionReceipt(wagmiConfig, { hash })
  }

  function invalidate(seatId: number) {
    qc.invalidateQueries({ queryKey: ['seats'] })
    qc.invalidateQueries({ queryKey: ['seat-detail', seatId] })
    qc.invalidateQueries({ queryKey: ['seat-rewards', seatId] })
    qc.invalidateQueries({ queryKey: ['board-stats'] })
    qc.invalidateQueries({ queryKey: ['tape'] })
  }

  async function doTakeVacant() {
    if (!selectedSeat || !address) return
    try {
      const priceRaw = parseUSDG(parseFloat(newPrice) || 10)
      const prepaidRaw = parseUSDG(parseFloat(prepaid) || 0.1)
      await ensureAllowance(VACANT_PRICE_RAW + prepaidRaw)
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS,
        abi: BOARD_ABI,
        functionName: 'takeVacantSeat',
        args: [BigInt(selectedSeat.seatId), priceRaw, prepaidRaw],
        chain: robinhoodTestnet,
        account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash)
      setTxStep('done')
      invalidate(selectedSeat.seatId)
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e))
      setTxStep('error')
    }
  }

  async function doReprice() {
    if (!selectedSeat || !address) return
    try {
      const priceRaw = parseUSDG(parseFloat(newPrice) || 1)
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS,
        abi: BOARD_ABI,
        functionName: 'setSeatPrice',
        args: [BigInt(selectedSeat.seatId), priceRaw],
        chain: robinhoodTestnet,
        account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash)
      setTxStep('done')
      invalidate(selectedSeat.seatId)
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e))
      setTxStep('error')
    }
  }

  async function doTopUp() {
    if (!selectedSeat || !address) return
    try {
      const amtRaw = parseUSDG(parseFloat(topupAmt) || 1)
      await ensureAllowance(amtRaw)
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS,
        abi: BOARD_ABI,
        functionName: 'topUpSeat',
        args: [BigInt(selectedSeat.seatId), amtRaw],
        chain: robinhoodTestnet,
        account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash)
      setTxStep('done')
      invalidate(selectedSeat.seatId)
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e))
      setTxStep('error')
    }
  }

  async function doTakeover() {
    if (!selectedSeat || !address || !selectedSeat.owner || !selectedSeat.price) return
    try {
      const priceRaw = parseUSDG(parseFloat(newPrice) || 1)
      const prepaidRaw = parseUSDG(parseFloat(prepaid) || 0.1)
      const expectedPrice = BigInt(selectedSeat.price)
      await ensureAllowance(expectedPrice + prepaidRaw)
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS,
        abi: BOARD_ABI,
        functionName: 'takeSeat',
        args: [
          BigInt(selectedSeat.seatId),
          selectedSeat.owner as `0x${string}`,
          expectedPrice,
          priceRaw,
          prepaidRaw,
        ],
        chain: robinhoodTestnet,
        account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash)
      setTxStep('done')
      invalidate(selectedSeat.seatId)
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e))
      setTxStep('error')
    }
  }

  async function doForeclose() {
    if (!selectedSeat || !address) return
    try {
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS,
        abi: BOARD_ABI,
        functionName: 'forecloseSeat',
        args: [BigInt(selectedSeat.seatId)],
        chain: robinhoodTestnet,
        account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash)
      setTxStep('done')
      invalidate(selectedSeat.seatId)
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e))
      setTxStep('error')
    }
  }

  function handleConfirm() {
    if (modal === 'take') doTakeVacant()
    else if (modal === 'reprice') doReprice()
    else if (modal === 'topup') doTopUp()
    else if (modal === 'takeover') doTakeover()
    else if (modal === 'foreclose') doForeclose()
  }

  // Per-seat weekly reward estimate (equal distribution from last 7d deposits)
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
    <>
      {/* Board grid */}
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
              const selected = seat.seatId === selectedId
              const cls = ['stile', seat.status.toLowerCase(), mine && 'mine', selected && 'selected']
                .filter(Boolean).join(' ')
              return (
                <div
                  key={seat.seatId}
                  className={cls}
                  onClick={() => { setTooltipSeat(null); setSelectedId(seat.seatId === selectedId ? null : seat.seatId) }}
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
      </div>

      {/* Drawer */}
      <div className={`drawer${selectedId === null ? ' closed' : ''}`}>
        {selectedSeat && (
          <>
            <div className="drawer-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ConcentricArt seatId={selectedSeat.seatId} />
                <div>
                  <div className="drawer-seat-num">{padSeat(selectedSeat.seatId)}</div>
                  <StatusBadge status={selectedSeat.status} />
                </div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>✕</button>
            </div>

            <div className="drawer-body">
              {selectedSeat.status !== 'VACANT' && (
                <>
                  {/* 4 core numbers */}
                  {selectedSeat.price && (() => {
                    const ask = BigInt(selectedSeat.price)
                    const realizedRewards = BigInt(rewardsData?.cumulativeBanked ?? '0')
                    const holdingCostWk = BigInt(selectedSeat.weeklyHoldingCost)
                    const netCarry = realizedRewards - holdingCostWk
                    const netPositive = netCarry >= 0n
                    return (
                      <div className="core-numbers">
                        <div className="cn-cell">
                          <div className="cn-label">ASK</div>
                          <div className="cn-val">{fmtUSDG(ask)}</div>
                        </div>
                        <div className="cn-cell">
                          <div className="cn-label">REALIZED REWARDS</div>
                          <div className="cn-val g">{fmtUSDG(realizedRewards)}</div>
                        </div>
                        <div className="cn-cell">
                          <div className="cn-label">HOLDING COST</div>
                          <div className="cn-val dim">{fmtUSDG(holdingCostWk)}<span className="cn-per">/wk</span></div>
                        </div>
                        <div className="cn-cell">
                          <div className="cn-label">NET CARRY</div>
                          <div className={`cn-val ${netPositive ? 'g' : 'r'}`}>
                            {netPositive ? '+' : '-'}{fmtUSDG(netPositive ? netCarry : -netCarry)}
                            <span className="cn-per">/wk</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="info-block">
                    {selectedSeat.owner && (
                      <div className="irow">
                        <span className="ilabel">Owner</span>
                        <span className="ival dim">{fmtAddr(selectedSeat.owner)}</span>
                      </div>
                    )}
                    {selectedSeat.price && (
                      <div className="irow">
                        <span className="ilabel">Price</span>
                        <span className="ival">{fmtUSDG(selectedSeat.price)}</span>
                      </div>
                    )}
                    <div className="irow">
                      <span className="ilabel">Weekly</span>
                      <span className="ival">{fmtUSDG(selectedSeat.weeklyHoldingCost)}</span>
                    </div>
                  </div>

                  <hr className="drawer-divider" />

                  <div className="bal-wrap">
                    <div className="irow">
                      <span className="ilabel">Balance</span>
                      <span className={`ival ${balClass(selectedSeat)}`}>
                        {fmtUSDG(selectedSeat.effectiveBalance)}
                      </span>
                    </div>
                    <div className="bal-track">
                      <div
                        className={`bal-fill ${balClass(selectedSeat)}`}
                        style={{ width: `${balWidth(selectedSeat)}%` }}
                      />
                    </div>
                    <div className="irow">
                      <span className="ilabel">Weeks left</span>
                      <span className="ival dim">
                        {weeksRemaining(
                          BigInt(selectedSeat.effectiveBalance),
                          BigInt(selectedSeat.price ?? '0'),
                        )}w
                      </span>
                    </div>
                    {selectedSeat.status === 'GRACE' && selectedSeat.graceEndsAt && (
                      <div className="irow">
                        <span className="ilabel">Grace ends</span>
                        <span className="ival a">{fmtDate(selectedSeat.graceEndsAt)}</span>
                      </div>
                    )}
                  </div>

                  <hr className="drawer-divider" />
                </>
              )}

              {/* Actions */}
              {selectedSeat.status === 'VACANT' ? (
                <button
                  className="abtn take"
                  onClick={() => openModal('take', selectedSeat)}
                  disabled={!address}
                >
                  {address ? `Take ${padSeat(selectedSeat.seatId)}` : 'Connect to Take'}
                </button>
              ) : isMine(selectedSeat) ? (
                <div className="abtn-row">
                  <button className="abtn-sm" onClick={() => openModal('topup', selectedSeat)}>
                    Top Up
                  </button>
                  <button className="abtn-sm" onClick={() => openModal('reprice', selectedSeat)}>
                    Reprice
                  </button>
                </div>
              ) : selectedSeat.status === 'FORECLOSABLE' ? (
                <button
                  className="abtn fore"
                  onClick={() => openModal('foreclose', selectedSeat)}
                  disabled={!address}
                >
                  Foreclose
                </button>
              ) : (
                <button
                  className="abtn over"
                  onClick={() => openModal('takeover', selectedSeat)}
                  disabled={!address}
                >
                  {address
                    ? `Take Over · ${fmtUSDG(selectedSeat.price)}`
                    : 'Connect to Take Over'}
                </button>
              )}

              {/* History */}
              {detailData?.history && detailData.history.length > 0 && (
                <>
                  <hr className="drawer-divider" />
                  <div className="hist-label">HISTORY</div>
                  <div>
                    {detailData.history.slice().reverse().slice(0, 12).map((ev, i) => (
                      <div key={i} className="th-row">
                        <span className="th-date">{fmtDate(ev.occurred_at)}</span>
                        <span className="th-event">{eventLabel(ev.event_type)}</span>
                        <span className="th-amt">
                          {ev.amount
                            ? fmtUSDG(ev.amount)
                            : ev.new_price
                            ? fmtUSDG(ev.new_price)
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
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
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && selectedSeat && (
        <ActionModal
          modal={modal}
          seat={selectedSeat}
          step={txStep}
          txHash={txHash}
          error={txError}
          newPrice={newPrice}
          onNewPrice={setNewPrice}
          prepaid={prepaid}
          onPrepaid={setPrepaid}
          topupAmt={topupAmt}
          onTopupAmt={setTopupAmt}
          onClose={closeModal}
          onConfirm={handleConfirm}
          rewards7d={perSeatWeekly7d}
          connected={!!address}
        />
      )}
    </>
  )
}

// ── Action Modal ─────────────────────────────────────────────────────────────

type ActionModalProps = {
  modal: ModalKind
  seat: Seat
  step: TxStep
  txHash: string | null
  error: string | null
  newPrice: string
  onNewPrice: (v: string) => void
  prepaid: string
  onPrepaid: (v: string) => void
  topupAmt: string
  onTopupAmt: (v: string) => void
  onClose: () => void
  onConfirm: () => void
  rewards7d: bigint
  connected: boolean
}

function ActionModal({
  modal, seat, step, txHash, error,
  newPrice, onNewPrice, prepaid, onPrepaid, topupAmt, onTopupAmt,
  onClose, onConfirm, rewards7d, connected,
}: ActionModalProps) {
  const busy = step === 'approving' || step === 'confirming'
  const needsApprove = modal === 'take' || modal === 'topup' || modal === 'takeover'

  const titles: Record<ModalKind, string> = {
    take: 'Take Seat',
    reprice: 'Set Price',
    topup: 'Top Up',
    takeover: 'Take Over',
    foreclose: 'Foreclose',
  }

  const confirmLabel: Record<ModalKind, string> = {
    take: 'Take Seat',
    reprice: 'Set Price',
    topup: 'Top Up',
    takeover: 'Take Over',
    foreclose: 'Foreclose',
  }

  function renderForm() {
    if (modal === 'take') {
      const priceRaw = parseUSDG(parseFloat(newPrice) || 10)
      const prepaidRaw = parseUSDG(parseFloat(prepaid) || 0.1)
      const minPrepaid = Number(minDeposit(priceRaw)) / 1_000_000
      const wkFee = Number(weeklyFee(priceRaw)) / 1_000_000
      return (
        <>
          <div className="mfield">
            <span className="mlabel">Seat Acquisition Price</span>
            <div className="mfixed">$10.00</div>
            <div className="mhint">Fixed cost to take a vacant seat</div>
          </div>
          <div className="mfield">
            <label className="mlabel">Your Self-Assessed Price (USDG)</label>
            <input
              className="minput" type="number" min="10" step="1"
              value={newPrice} onChange={e => onNewPrice(e.target.value)}
            />
            <div className="mhint">Others must pay this price to take the seat from you</div>
          </div>
          <div className="mfield">
            <label className="mlabel">Prepaid Deposit (USDG)</label>
            <input
              className="minput" type="number" min={minPrepaid.toFixed(2)} step="0.10"
              value={prepaid} onChange={e => onPrepaid(e.target.value)}
            />
            <div className="mhint">
              Min {minPrepaid.toFixed(2)} · {wkFee.toFixed(4)}/week
            </div>
          </div>
          <div className="cost-box">
            <div className="crow">
              <span>Seat acquisition</span>
              <span className="cv">{fmtUSDG(VACANT_PRICE_RAW)}</span>
            </div>
            <div className="crow">
              <span>Prepaid deposit</span>
              <span className="cv">{fmtUSDG(prepaidRaw)}</span>
            </div>
            <div className="crow tot">
              <span>Total</span>
              <span className="cv">{fmtUSDG(VACANT_PRICE_RAW + prepaidRaw)}</span>
            </div>
          </div>
        </>
      )
    }

    if (modal === 'reprice') {
      return (
        <div className="mfield">
          <label className="mlabel">New Price (USDG)</label>
          <input
            className="minput" type="number" min="1" step="1"
            value={newPrice} onChange={e => onNewPrice(e.target.value)}
          />
          <div className="mhint">Current: {seat.price ? fmtUSDG(seat.price) : '—'}</div>
        </div>
      )
    }

    if (modal === 'topup') {
      const amtRaw = parseUSDG(parseFloat(topupAmt) || 1)
      const weekly = BigInt(seat.weeklyHoldingCost)
      const weeksAdded = weekly > 0n ? (Number(amtRaw) / Number(weekly)).toFixed(1) : '—'
      return (
        <>
          <div className="mfield">
            <label className="mlabel">Amount (USDG)</label>
            <input
              className="minput" type="number" min="0.01" step="0.01"
              value={topupAmt} onChange={e => onTopupAmt(e.target.value)}
            />
            <div className="mhint">Adds ≈{weeksAdded} weeks of coverage</div>
          </div>
          <div className="cost-box">
            <div className="crow">
              <span>Weekly cost</span>
              <span className="cv">{fmtUSDG(seat.weeklyHoldingCost)}</span>
            </div>
            <div className="crow tot">
              <span>Top-up amount</span>
              <span className="cv">{fmtUSDG(amtRaw)}</span>
            </div>
          </div>
        </>
      )
    }

    if (modal === 'takeover') {
      const priceRaw = parseUSDG(parseFloat(newPrice) || 10)
      const prepaidRaw = parseUSDG(parseFloat(prepaid) || 0.1)
      const seatPrice = BigInt(seat.price ?? '0')
      const minPrepaid = Number(minDeposit(priceRaw)) / 1_000_000
      const wkFee = Number(weeklyFee(priceRaw)) / 1_000_000
      return (
        <>
          <div className="mfield">
            <span className="mlabel">Current Seat Price</span>
            <div className="mfixed">{seat.price ? fmtUSDG(seat.price) : '—'}</div>
            <div className="mhint">You pay this to take the seat (95% goes to seller)</div>
          </div>
          <div className="mfield">
            <label className="mlabel">Your New Price (USDG)</label>
            <input
              className="minput" type="number" min="1" step="1"
              value={newPrice} onChange={e => onNewPrice(e.target.value)}
            />
          </div>
          <div className="mfield">
            <label className="mlabel">Your Prepaid Deposit (USDG)</label>
            <input
              className="minput" type="number" min={minPrepaid.toFixed(2)} step="0.10"
              value={prepaid} onChange={e => onPrepaid(e.target.value)}
            />
            <div className="mhint">
              Min {minPrepaid.toFixed(2)} · {wkFee.toFixed(4)}/week
            </div>
          </div>
          {(() => {
            const protocolFee = seatPrice * 5n / 100n
            const sellerReceives = seatPrice - protocolFee
            return (
              <div className="cost-box">
                <div className="crow tot">
                  <span>YOU PAY</span>
                  <span className="cv">{fmtUSDG(seatPrice + prepaidRaw)}</span>
                </div>
                <div className="crow" style={{ paddingLeft: 12 }}>
                  <span className="dim">Seat acquisition</span>
                  <span className="cv dim">{fmtUSDG(seatPrice)}</span>
                </div>
                <div className="crow" style={{ paddingLeft: 12 }}>
                  <span className="dim">Prepaid deposit</span>
                  <span className="cv dim">{fmtUSDG(prepaidRaw)}</span>
                </div>
                <div className="crow" style={{ borderTop: '1px solid var(--bd0)', marginTop: 4, paddingTop: 4 }}>
                  <span>SELLER RECEIVES</span>
                  <span className="cv g">{fmtUSDG(sellerReceives)}</span>
                </div>
                <div className="crow">
                  <span>PROTOCOL FEE</span>
                  <span className="cv dim">{fmtUSDG(protocolFee)}</span>
                </div>
              </div>
            )
          })()}
          {(() => {
            const wkCost = weeklyFee(priceRaw)
            const netCarry = rewards7d - wkCost
            return (
              <div className="takeover-preview">
                <div className="tp-label">EST. WEEKLY RETURNS (BASED ON 7D TRAILING)</div>
                <div className="tp-rows">
                  <div className="tp-row">
                    <span>7D reward / seat</span>
                    <span className="tp-v g">{fmtUSDG(rewards7d)}</span>
                  </div>
                  <div className="tp-row">
                    <span>Holding cost</span>
                    <span className="tp-v dim">−{fmtUSDG(wkCost)}</span>
                  </div>
                  <div className="tp-row tp-net">
                    <span>Net carry</span>
                    <span className={`tp-v ${netCarry >= 0n ? 'g' : 'r'}`}>
                      {netCarry >= 0n ? '+' : '−'}{fmtUSDG(netCarry >= 0n ? netCarry : -netCarry)}/wk
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )
    }

    if (modal === 'foreclose') {
      return (
        <div className="mfield">
          <div className="mfixed">{padSeat(seat.seatId)} is foreclosable.</div>
          <div className="mhint" style={{ marginTop: 6 }}>
            Balance exhausted and grace period expired.
            Any wallet may foreclose this seat.
          </div>
        </div>
      )
    }

    return null
  }

  function renderSuccess() {
    const isOwnership = modal === 'take' || modal === 'takeover'
    const actionLabel =
      modal === 'reprice' ? 'REPRICED' :
      modal === 'topup' ? 'TOPPED UP' : 'FORECLOSED'
    return (
      <div className="share-card">
        <div className="sc-label">BOARD #001 / GENESIS</div>
        <div className="sc-seat">{padSeat(seat.seatId)}</div>
        {isOwnership ? (
          <div className="sc-title sc-yours">SEAT IS YOURS</div>
        ) : (
          <div className="sc-title">{actionLabel}</div>
        )}
        {txHash && (
          <div className="sc-row">
            <span>Tx</span>
            <span className="sc-v">{fmtAddr(txHash)}</span>
          </div>
        )}
        {isOwnership && (
          <div className="sc-row" style={{ marginTop: 8 }}>
            <span>New price</span>
            <span className="sc-v">{fmtUSDG(parseUSDG(parseFloat(newPrice) || 0))}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <div className="modal-title">{titles[modal]} {padSeat(seat.seatId)}</div>
            {seat.owner && modal !== 'take' && (
              <div className="modal-sub">Owner: {fmtAddr(seat.owner)}</div>
            )}
          </div>
          <button className="modal-close" onClick={onClose} disabled={busy}>✕</button>
        </div>

        {needsApprove && step !== 'form' && step !== 'done' && step !== 'error' && (
          <div className="modal-steps">
            <div className="mstep">
              <span className={`snum ${step === 'approving' ? 'active' : 'done'}`}>1</span>
              Approve USDG
            </div>
            <div className="mstep">
              <span className={`snum ${step === 'confirming' ? 'active' : ''}`}>2</span>
              Confirm
            </div>
          </div>
        )}

        <div className="modal-body">
          {step === 'done' ? renderSuccess() : renderForm()}
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          {step === 'done' ? (
            <button className="mbtn secondary" onClick={onClose}>Close</button>
          ) : (
            <>
              <button className="mbtn secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                className="mbtn primary"
                onClick={onConfirm}
                disabled={busy || !connected}
              >
                {step === 'approving' ? (
                  <><span className="spinner" style={{ marginRight: 6, verticalAlign: 'middle' }} />Approving…</>
                ) : step === 'confirming' ? (
                  <><span className="spinner" style={{ marginRight: 6, verticalAlign: 'middle' }} />Confirming…</>
                ) : step === 'error' ? (
                  'Retry'
                ) : (
                  confirmLabel[modal]
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
