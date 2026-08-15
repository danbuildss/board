'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { writeContract, waitForTransactionReceipt, readContract } from 'wagmi/actions'
import { wagmiConfig, BOARD_ADDRESS, USDG_ADDRESS, robinhoodTestnet } from '@/lib/config'
import { BOARD_ABI, ERC20_ABI } from '@/lib/abi'
import {
  fmtUSDG, fmtAddr, padSeat, minDeposit, weeklyFee, weeksRemaining,
  fmtDate, fmtTimestamp, eventLabel, parseUSDG,
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
  block_number: number
  amount: string | null
  new_price: string | null
  previous_price: string | null
  previous_owner: string | null
  new_owner: string | null
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

function balClass(seat: Seat): string {
  if (!seat.price || seat.price === '0') return 'g'
  const w = parseFloat(weeksRemaining(BigInt(seat.effectiveBalance), BigInt(seat.price)))
  if (w > 4) return 'g'
  if (w > 2) return 'a'
  return 'r'
}

function balWidth(seat: Seat): number {
  if (!seat.price || seat.price === '0' || seat.weeklyHoldingCost === '0') return 0
  const weeks = +seat.effectiveBalance / +seat.weeklyHoldingCost
  return Math.min(100, Math.max(0, (weeks / 10) * 100))
}

function heldForLabel(history: HistoryEvent[], currentOwner: string | null): string {
  if (!currentOwner || !history?.length) return '—'
  const ownerEvents = history.filter(e =>
    (e.event_type === 'SeatAcquired' || e.event_type === 'SeatTaken') &&
    e.new_owner?.toLowerCase() === currentOwner.toLowerCase()
  )
  if (!ownerEvents.length) return '—'
  const last = ownerEvents[ownerEvents.length - 1]
  if (!last.occurred_at) return '—'
  const days = Math.floor((Date.now() - new Date(last.occurred_at).getTime()) / 86_400_000)
  return days === 0 ? '<1d' : `${days}d`
}

function LargeConcentricArt({ seatId }: { seatId: number }) {
  const layers = [
    { size: 160, color: '#111d00' },
    { size: 130, color: '#162400' },
    { size: 102, color: '#1e3400' },
    { size: 76,  color: '#2c4c00' },
    { size: 52,  color: '#4a7800' },
    { size: 30,  color: '#7ab800' },
  ]
  return (
    <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {layers.map((l, i) => (
        <div key={i} style={{ position: 'absolute', width: l.size, height: l.size, border: `1px solid ${l.color}` }} />
      ))}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)', fontWeight: 700, zIndex: 1, letterSpacing: '.06em' }}>
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

function MiniBoardGrid({ seats, currentId }: { seats: Seat[]; currentId: number }) {
  const grid = Array.from({ length: 100 }, (_, i) => {
    const id = i + 1
    return seats.find(s => s.seatId === id) ?? { seatId: id, status: 'VACANT' as const }
  })
  return (
    <div className="sd-mini-grid">
      {grid.map(s => (
        <Link key={s.seatId} href={`/board/genesis/seat/${s.seatId}`}>
          <div
            className={`sd-mini-dot ${s.status.toLowerCase()}${s.seatId === currentId ? ' current' : ''}`}
            title={`${padSeat(s.seatId)} · ${s.status}`}
          />
        </Link>
      ))}
    </div>
  )
}

export default function SeatDetailPage() {
  const params = useParams<{ id: string }>()
  const seatId = parseInt(params.id, 10)
  const { address } = useAccount()
  const qc = useQueryClient()

  const { data: seat, isLoading } = useQuery<SeatDetail>({
    queryKey: ['seat-detail', seatId],
    queryFn: () => fetch(`/api/boards/genesis/seats/${seatId}`).then(r => r.json()),
    enabled: !isNaN(seatId),
    refetchInterval: 30_000,
  })

  const { data: boardRewards } = useQuery<BoardRewards>({
    queryKey: ['board-rewards-summary'],
    queryFn: () => fetch('/api/boards/genesis/rewards').then(r => r.json()),
    refetchInterval: 60_000,
  })

  const { data: seatsData } = useQuery<{ seats: Seat[] }>({
    queryKey: ['seats'],
    queryFn: () => fetch('/api/boards/genesis/seats').then(r => r.json()),
  })
  const allSeats = seatsData?.seats ?? []

  const [modal, setModal] = useState<ModalKind | null>(null)
  const [txStep, setTxStep] = useState<TxStep>('form')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [newPrice, setNewPrice] = useState('10')
  const [prepaid, setPrepaid] = useState('0.50')
  const [topupAmt, setTopupAmt] = useState('1.00')

  const isMine = !!seat?.owner && !!address && seat.owner.toLowerCase() === address.toLowerCase()

  function openModal(kind: ModalKind) {
    if (!seat) return
    setModal(kind); setTxStep('form'); setTxHash(null); setTxError(null)
    if (kind === 'take') {
      setNewPrice('10')
      setPrepaid((Number(minDeposit(VACANT_PRICE_RAW)) / 1_000_000).toFixed(2))
    } else if (kind === 'topup' && seat.weeklyHoldingCost) {
      const weekly = BigInt(seat.weeklyHoldingCost)
      setTopupAmt(weekly > 0n ? Math.max(Number(weekly * 4n) / 1_000_000, 0.5).toFixed(2) : '1.00')
    } else if (kind === 'takeover' && seat.price) {
      setPrepaid((Number(minDeposit(BigInt(seat.price))) / 1_000_000).toFixed(2))
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
      address: USDG_ADDRESS, abi: ERC20_ABI,
      functionName: 'allowance', args: [address, BOARD_ADDRESS],
    })
    if ((allowance as bigint) >= needed) return
    setTxStep('approving')
    const hash = await writeContract(wagmiConfig, {
      address: USDG_ADDRESS, abi: ERC20_ABI,
      functionName: 'approve', args: [BOARD_ADDRESS, needed],
      chain: robinhoodTestnet, account: address,
    })
    await waitForTransactionReceipt(wagmiConfig, { hash })
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['seat-detail', seatId] })
    qc.invalidateQueries({ queryKey: ['seats'] })
    qc.invalidateQueries({ queryKey: ['board-stats'] })
    qc.invalidateQueries({ queryKey: ['tape'] })
  }

  async function doTakeVacant() {
    if (!seat || !address) return
    try {
      const priceRaw = parseUSDG(parseFloat(newPrice) || 10)
      const prepaidRaw = parseUSDG(parseFloat(prepaid) || 0.1)
      await ensureAllowance(VACANT_PRICE_RAW + prepaidRaw)
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS, abi: BOARD_ABI,
        functionName: 'takeVacantSeat',
        args: [BigInt(seat.seatId), priceRaw, prepaidRaw],
        chain: robinhoodTestnet, account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash); setTxStep('done'); invalidate()
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e)); setTxStep('error')
    }
  }

  async function doReprice() {
    if (!seat || !address) return
    try {
      const priceRaw = parseUSDG(parseFloat(newPrice) || 1)
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS, abi: BOARD_ABI,
        functionName: 'setSeatPrice',
        args: [BigInt(seat.seatId), priceRaw],
        chain: robinhoodTestnet, account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash); setTxStep('done'); invalidate()
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e)); setTxStep('error')
    }
  }

  async function doTopUp() {
    if (!seat || !address) return
    try {
      const amtRaw = parseUSDG(parseFloat(topupAmt) || 1)
      await ensureAllowance(amtRaw)
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS, abi: BOARD_ABI,
        functionName: 'topUpSeat',
        args: [BigInt(seat.seatId), amtRaw],
        chain: robinhoodTestnet, account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash); setTxStep('done'); invalidate()
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e)); setTxStep('error')
    }
  }

  async function doTakeover() {
    if (!seat || !address || !seat.owner || !seat.price) return
    try {
      const priceRaw = parseUSDG(parseFloat(newPrice) || 1)
      const prepaidRaw = parseUSDG(parseFloat(prepaid) || 0.1)
      const expectedPrice = BigInt(seat.price)
      await ensureAllowance(expectedPrice + prepaidRaw)
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS, abi: BOARD_ABI,
        functionName: 'takeSeat',
        args: [BigInt(seat.seatId), seat.owner as `0x${string}`, expectedPrice, priceRaw, prepaidRaw],
        chain: robinhoodTestnet, account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash); setTxStep('done'); invalidate()
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e)); setTxStep('error')
    }
  }

  async function doForeclose() {
    if (!seat || !address) return
    try {
      setTxStep('confirming')
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_ADDRESS, abi: BOARD_ABI,
        functionName: 'forecloseSeat',
        args: [BigInt(seat.seatId)],
        chain: robinhoodTestnet, account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setTxHash(hash); setTxStep('done'); invalidate()
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setTxError(err?.shortMessage ?? err?.message ?? String(e)); setTxStep('error')
    }
  }

  function handleConfirm() {
    if (modal === 'take') doTakeVacant()
    else if (modal === 'reprice') doReprice()
    else if (modal === 'topup') doTopUp()
    else if (modal === 'takeover') doTakeover()
    else if (modal === 'foreclose') doForeclose()
  }

  const perSeatWeekly7d = (() => {
    if (!boardRewards) return 0n
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const total7d = boardRewards.recentDeposits
      .filter(d => new Date(d.occurred_at).getTime() > cutoff)
      .reduce((s, d) => s + BigInt(d.amount), 0n)
    const n = BigInt(Math.max(1, boardRewards.activeSeatCount))
    return total7d / n
  })()

  if (isNaN(seatId) || seatId < 1 || seatId > 100) {
    return (
      <div className="page-scroll">
        <div className="page-inner">
          <div className="empty-state">Invalid seat number.</div>
        </div>
      </div>
    )
  }

  if (isLoading || !seat) {
    return (
      <div className="page-scroll">
        <div className="page-inner">
          <div className="empty-state">Loading {padSeat(seatId)}…</div>
        </div>
      </div>
    )
  }

  const seatPrice = seat.price ? BigInt(seat.price) : 0n
  const holdingCostWk = seat.weeklyHoldingCost ? BigInt(seat.weeklyHoldingCost) : 0n
  const effBal = seat.effectiveBalance ? BigInt(seat.effectiveBalance) : 0n
  const netCarry = perSeatWeekly7d - holdingCostWk
  const netPositive = netCarry >= 0n

  const impliedAPY = (() => {
    if (seatPrice === 0n || perSeatWeekly7d === 0n) return null
    const apy = (Number(perSeatWeekly7d * 52n) / Number(seatPrice)) * 100
    return apy.toFixed(1) + '%'
  })()

  const heldFor = seat.status !== 'VACANT'
    ? heldForLabel(seat.history ?? [], seat.owner)
    : '—'

  const recentActivity = (seat.history ?? []).slice().reverse().slice(0, 6)
  const isOccupied = seat.status !== 'VACANT'

  return (
    <>
      <div className="page-scroll">
        <div className="sd-page">

          {/* ── Left panel ── */}
          <div className="sd-left">
            <div className="sd-art-wrap">
              <LargeConcentricArt seatId={seat.seatId} />
              <div style={{ textAlign: 'center' }}>
                <div className="sd-seat-number">{padSeat(seat.seatId)}</div>
                <div className="sd-seat-of">of 100</div>
              </div>
              <div className="sd-board-label">BOARD / GENESIS · EDITION 1</div>
            </div>

            <div className="sd-dna">
              <div className="sd-dna-label">SEAT DNA</div>
              <div className="sd-dna-row">
                <span className="sd-dna-key">Contract</span>
                <span className="sd-dna-val" title={BOARD_ADDRESS}>{fmtAddr(BOARD_ADDRESS)}</span>
              </div>
              <div className="sd-dna-row">
                <span className="sd-dna-key">Seat ID</span>
                <span className="sd-dna-val">{seat.seatId}</span>
              </div>
              <div className="sd-dna-row">
                <span className="sd-dna-key">Board</span>
                <span className="sd-dna-val">GENESIS / USDG</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: 'var(--font-mono)' }}>
                100 SEATS
              </div>
              <MiniBoardGrid seats={allSeats} currentId={seat.seatId} />
              <div className="sd-mini-legend">
                <div className="sd-legend-item">
                  <div className="sd-legend-dot" style={{ background: 'var(--green-d)' }} />
                  {boardRewards?.activeSeatCount ?? 0} ACTIVE
                </div>
                <div className="sd-legend-item">
                  <div className="sd-legend-dot" style={{ background: 'var(--bg4)' }} />
                  {100 - (boardRewards?.activeSeatCount ?? 0)} VACANT
                </div>
              </div>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="sd-right">

            {/* Breadcrumb + LIVE */}
            <div className="sd-head-row">
              <div className="sd-breadcrumb">
                <Link href="/board/genesis">BOARD</Link>
                <span className="sd-breadcrumb-sep">/</span>
                <Link href="/board/genesis">GENESIS</Link>
                <span className="sd-breadcrumb-sep">/</span>
                <span className="sd-breadcrumb-current">{padSeat(seat.seatId)}</span>
              </div>
              <div className="live-badge">
                <span className="live-badge-dot" />
                LIVE
              </div>
            </div>

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <StatusBadge status={seat.status} />
              {seat.status === 'GRACE' && (
                <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                  Grace ends {fmtDate(seat.graceEndsAt)}
                </span>
              )}
              {seat.status === 'FORECLOSABLE' && (
                <span style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                  Grace expired — foreclosable now
                </span>
              )}
            </div>

            {/* 4-cell info grid */}
            <div className="sd-info-grid">
              <div className="sd-info-cell">
                <div className="sd-info-label">OWNER</div>
                <div className="sd-info-val dim" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {seat.owner ? fmtAddr(seat.owner) : '—'}
                  {isMine && <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700 }}>YOU</span>}
                </div>
              </div>
              <div className="sd-info-cell">
                <div className="sd-info-label">HELD FOR</div>
                <div className="sd-info-val">{heldFor}</div>
              </div>
              <div className="sd-info-cell">
                <div className="sd-info-label">ASK</div>
                <div className="sd-info-val">{seat.price ? fmtUSDG(seat.price) : '$10.00'}</div>
              </div>
              <div className="sd-info-cell">
                <div className="sd-info-label">RATE</div>
                <div className="sd-info-val dim">
                  0.5%<span style={{ fontSize: 10, color: 'var(--t3)' }}>/WK</span>
                </div>
              </div>
            </div>

            {/* Yield overview */}
            {isOccupied && (
              <div className="sd-section">
                <div className="sd-section-head">
                  <span className="sd-section-title">YIELD OVERVIEW</span>
                  <span className="sd-sim-tag">SIMULATED</span>
                </div>
                <div className="sd-yield-grid">
                  <div className="sd-yield-cell">
                    <div className="sd-yield-label">7D SIM YIELD</div>
                    <div className="sd-yield-val g">{fmtUSDG(perSeatWeekly7d)}</div>
                  </div>
                  <div className="sd-yield-cell">
                    <div className="sd-yield-label">HOLDING COST</div>
                    <div className="sd-yield-val dim">
                      {fmtUSDG(holdingCostWk)}<span style={{ fontSize: 9 }}>/wk</span>
                    </div>
                  </div>
                  <div className="sd-yield-cell">
                    <div className="sd-yield-label">NET CARRY</div>
                    <div className={`sd-yield-val ${netPositive ? 'g' : 'r'}`}>
                      {netPositive ? '+' : '−'}{fmtUSDG(netPositive ? netCarry : -netCarry)}
                      <span style={{ fontSize: 9 }}>/wk</span>
                    </div>
                  </div>
                  <div className="sd-yield-cell">
                    <div className="sd-yield-label">IMPLIED APY</div>
                    <div className={`sd-yield-val ${impliedAPY ? 'g' : 'dim'}`}>{impliedAPY ?? '—'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Holding runway */}
            {isOccupied && (
              <div className="sd-section">
                <div className="sd-section-head">
                  <span className="sd-section-title">HOLDING RUNWAY</span>
                </div>
                <div className="sd-runway-track">
                  <div
                    className={`sd-runway-fill ${balClass(seat)}`}
                    style={{ width: `${balWidth(seat)}%` }}
                  />
                </div>
                <div className="sd-runway-info">
                  <div className="sd-runway-cell">
                    <div className="sd-info-label">BALANCE</div>
                    <div className={`sd-info-val ${balClass(seat)}`} style={{ fontSize: 13 }}>
                      {fmtUSDG(effBal)}
                    </div>
                  </div>
                  <div className="sd-runway-cell">
                    <div className="sd-info-label">WEEKS LEFT</div>
                    <div className="sd-info-val" style={{ fontSize: 13 }}>
                      {seatPrice > 0n ? weeksRemaining(effBal, seatPrice) : '—'}w
                    </div>
                  </div>
                  <div className="sd-runway-cell">
                    <div className="sd-info-label">DEPLETES</div>
                    <div className="sd-info-val dim" style={{ fontSize: 12 }}>
                      {fmtDate(seat.estimatedDepletionAt)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="sd-section">
              <div className="sd-section-head">
                <span className="sd-section-title">ACTIONS</span>
              </div>
              {seat.status === 'VACANT' ? (
                <button className="abtn take" onClick={() => openModal('take')} disabled={!address}>
                  {address ? `Take ${padSeat(seat.seatId)}` : 'Connect Wallet to Take'}
                </button>
              ) : isMine ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="abtn-row">
                    <button className="abtn-sm" onClick={() => openModal('topup')}>Top Up</button>
                    <button className="abtn-sm" onClick={() => openModal('reprice')}>Reprice</button>
                  </div>
                  <button
                    className="abtn-sm"
                    style={{ width: '100%' }}
                    onClick={() => {
                      const price = seat.price ? `$${(+seat.price / 1_000_000).toFixed(0)}` : ''
                      const text = `I own Seat ${padSeat(seat.seatId)} on BOARD #001 / GENESIS${price ? ` · Ask ${price}` : ''}.\n\nThink you can take it?\n\nhttps://playboard.xyz/board/genesis`
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
                    }}
                  >
                    Share Seat →
                  </button>
                </div>
              ) : seat.status === 'FORECLOSABLE' ? (
                <button className="abtn fore" onClick={() => openModal('foreclose')} disabled={!address}>
                  Foreclose
                </button>
              ) : (
                <button className="abtn over" onClick={() => openModal('takeover')} disabled={!address}>
                  {address ? `Take Over · ${fmtUSDG(seat.price)}` : 'Connect Wallet to Take Over'}
                </button>
              )}
            </div>

            {/* Recent activity */}
            {recentActivity.length > 0 && (
              <div className="sd-section">
                <div className="sd-section-head">
                  <span className="sd-section-title">RECENT ACTIVITY</span>
                </div>
                <div className="sd-activity-strip">
                  {recentActivity.map((ev, i) => (
                    <div key={i} className="sd-activity-row">
                      <span className="sd-act-date">{fmtDate(ev.occurred_at)}</span>
                      <span className="sd-act-event">{eventLabel(ev.event_type)}</span>
                      <span className="sd-act-amount">
                        {ev.amount ? fmtUSDG(ev.amount) : ev.new_price ? fmtUSDG(ev.new_price) : '—'}
                      </span>
                      <span className="sd-act-time">{fmtTimestamp(ev.occurred_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {modal && seat && (
        <SeatActionModal
          modal={modal}
          seat={seat}
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

function SeatActionModal({
  modal, seat, step, txHash, error,
  newPrice, onNewPrice, prepaid, onPrepaid, topupAmt, onTopupAmt,
  onClose, onConfirm, rewards7d, connected,
}: ActionModalProps) {
  const busy = step === 'approving' || step === 'confirming'
  const needsApprove = modal === 'take' || modal === 'topup' || modal === 'takeover'

  const titles: Record<ModalKind, string> = {
    take: 'Take Seat', reprice: 'Set Price', topup: 'Top Up',
    takeover: 'Take Over', foreclose: 'Foreclose',
  }
  const confirmLabel: Record<ModalKind, string> = {
    take: 'Take Seat', reprice: 'Set Price', topup: 'Top Up',
    takeover: 'Take Over', foreclose: 'Foreclose',
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
            <input className="minput" type="number" min="10" step="1"
              value={newPrice} onChange={e => onNewPrice(e.target.value)} />
            <div className="mhint">Others must pay this price to take the seat from you</div>
          </div>
          <div className="mfield">
            <label className="mlabel">Prepaid Deposit (USDG)</label>
            <input className="minput" type="number" min={minPrepaid.toFixed(2)} step="0.10"
              value={prepaid} onChange={e => onPrepaid(e.target.value)} />
            <div className="mhint">Min {minPrepaid.toFixed(2)} · {wkFee.toFixed(4)}/week</div>
          </div>
          <div className="cost-box">
            <div className="crow"><span>Seat acquisition</span><span className="cv">{fmtUSDG(VACANT_PRICE_RAW)}</span></div>
            <div className="crow"><span>Prepaid deposit</span><span className="cv">{fmtUSDG(prepaidRaw)}</span></div>
            <div className="crow tot"><span>Total</span><span className="cv">{fmtUSDG(VACANT_PRICE_RAW + prepaidRaw)}</span></div>
          </div>
        </>
      )
    }
    if (modal === 'reprice') {
      return (
        <div className="mfield">
          <label className="mlabel">New Price (USDG)</label>
          <input className="minput" type="number" min="1" step="1"
            value={newPrice} onChange={e => onNewPrice(e.target.value)} />
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
            <input className="minput" type="number" min="0.01" step="0.01"
              value={topupAmt} onChange={e => onTopupAmt(e.target.value)} />
            <div className="mhint">Adds ≈{weeksAdded} weeks of coverage</div>
          </div>
          <div className="cost-box">
            <div className="crow"><span>Weekly cost</span><span className="cv">{fmtUSDG(seat.weeklyHoldingCost)}</span></div>
            <div className="crow tot"><span>Top-up amount</span><span className="cv">{fmtUSDG(amtRaw)}</span></div>
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
      const protocolFee = seatPrice * 5n / 100n
      const sellerReceives = seatPrice - protocolFee
      const wkCost = weeklyFee(priceRaw)
      const netCarry = rewards7d - wkCost
      return (
        <>
          <div className="mfield">
            <span className="mlabel">Current Seat Price</span>
            <div className="mfixed">{seat.price ? fmtUSDG(seat.price) : '—'}</div>
            <div className="mhint">You pay this to take the seat (95% goes to seller)</div>
          </div>
          <div className="mfield">
            <label className="mlabel">Your New Price (USDG)</label>
            <input className="minput" type="number" min="1" step="1"
              value={newPrice} onChange={e => onNewPrice(e.target.value)} />
          </div>
          <div className="mfield">
            <label className="mlabel">Your Prepaid Deposit (USDG)</label>
            <input className="minput" type="number" min={minPrepaid.toFixed(2)} step="0.10"
              value={prepaid} onChange={e => onPrepaid(e.target.value)} />
            <div className="mhint">Min {minPrepaid.toFixed(2)} · {wkFee.toFixed(4)}/week</div>
          </div>
          <div className="cost-box">
            <div className="crow tot"><span>YOU PAY</span><span className="cv">{fmtUSDG(seatPrice + prepaidRaw)}</span></div>
            <div className="crow" style={{ paddingLeft: 12 }}><span className="dim">Seat acquisition</span><span className="cv dim">{fmtUSDG(seatPrice)}</span></div>
            <div className="crow" style={{ paddingLeft: 12 }}><span className="dim">Prepaid deposit</span><span className="cv dim">{fmtUSDG(prepaidRaw)}</span></div>
            <div className="crow" style={{ borderTop: '1px solid var(--bd0)', marginTop: 4, paddingTop: 4 }}>
              <span>SELLER RECEIVES</span><span className="cv g">{fmtUSDG(sellerReceives)}</span>
            </div>
            <div className="crow"><span>PROTOCOL FEE</span><span className="cv dim">{fmtUSDG(protocolFee)}</span></div>
          </div>
          <div className="takeover-preview">
            <div className="tp-label">EST. WEEKLY RETURNS (7D TRAILING · SIMULATED)</div>
            <div className="tp-rows">
              <div className="tp-row"><span>7D reward / seat</span><span className="tp-v g">{fmtUSDG(rewards7d)}</span></div>
              <div className="tp-row"><span>Holding cost</span><span className="tp-v dim">−{fmtUSDG(wkCost)}</span></div>
              <div className="tp-row tp-net">
                <span>Net carry</span>
                <span className={`tp-v ${netCarry >= 0n ? 'g' : 'r'}`}>
                  {netCarry >= 0n ? '+' : '−'}{fmtUSDG(netCarry >= 0n ? netCarry : -netCarry)}/wk
                </span>
              </div>
            </div>
          </div>
        </>
      )
    }
    if (modal === 'foreclose') {
      return (
        <div className="mfield">
          <div className="mfixed">{padSeat(seat.seatId)} is foreclosable.</div>
          <div className="mhint" style={{ marginTop: 6 }}>
            Balance exhausted and grace period expired. Any wallet may foreclose this seat.
          </div>
        </div>
      )
    }
    return null
  }

  function renderSuccess() {
    const isOwnership = modal === 'take' || modal === 'takeover'
    const actionLabel = modal === 'reprice' ? 'REPRICED' : modal === 'topup' ? 'TOPPED UP' : 'FORECLOSED'
    return (
      <div className="share-card">
        <div className="sc-label">BOARD #001 / GENESIS</div>
        <div className="sc-seat">{padSeat(seat.seatId)}</div>
        {isOwnership
          ? <div className="sc-title" style={{ color: 'var(--green)' }}>SEAT IS YOURS</div>
          : <div className="sc-title">{actionLabel}</div>}
        {txHash && (
          <div className="sc-row"><span>Tx</span><span className="sc-v">{fmtAddr(txHash)}</span></div>
        )}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
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
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <button className="mbtn secondary" onClick={onClose} style={{ flex: 1 }}>Close</button>
              <button
                className="mbtn primary"
                style={{ flex: 1 }}
                onClick={() => {
                  const isOwnership = modal === 'take' || modal === 'takeover'
                  const price = seat.price ? `$${(+seat.price / 1_000_000).toFixed(0)}` : ''
                  const text = isOwnership
                    ? `Just took Seat ${padSeat(seat.seatId)} on BOARD #001 / GENESIS${price ? ` · Ask ${price}` : ''}.\n\nCan you take it from me?\n\nhttps://playboard.xyz/board/genesis`
                    : `Seat ${padSeat(seat.seatId)} updated on BOARD #001 / GENESIS.\n\nhttps://playboard.xyz/board/genesis`
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
                }}
              >
                Share on X
              </button>
            </div>
          ) : (
            <>
              <button className="mbtn secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="mbtn primary" onClick={onConfirm} disabled={busy || !connected}>
                {step === 'approving' ? (
                  <><span className="spinner" style={{ marginRight: 6, verticalAlign: 'middle' }} />Approving…</>
                ) : step === 'confirming' ? (
                  <><span className="spinner" style={{ marginRight: 6, verticalAlign: 'middle' }} />Confirming…</>
                ) : step === 'error' ? 'Retry' : confirmLabel[modal]}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
