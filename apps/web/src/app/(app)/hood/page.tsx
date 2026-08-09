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

type ModalKind = 'take' | 'reprice' | 'topup' | 'takeover' | 'foreclose'
type TxStep = 'form' | 'approving' | 'confirming' | 'done' | 'error'

const VACANT_PRICE_RAW = 10_000_000n

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
    queryFn: () => fetch('/api/boards/hood/seats').then(r => r.json()),
  })
  const seats = seatsData?.seats ?? []

  const { data: boardData } = useQuery<{ stats: Record<string, number> }>({
    queryKey: ['board-stats'],
    queryFn: () => fetch('/api/boards/hood').then(r => r.json()),
  })
  const stats = boardData?.stats

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tooltipSeat, setTooltipSeat] = useState<Seat | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const selectedSeat = seats.find(s => s.seatId === selectedId) ?? null

  const { data: detailData } = useQuery<SeatDetail>({
    queryKey: ['seat-detail', selectedId],
    queryFn: () => fetch(`/api/boards/hood/seats/${selectedId}`).then(r => r.json()),
    enabled: selectedId !== null,
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
                <span className="board-title">HOOD BOARD</span>
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
              <div>
                <div className="drawer-seat-num">{padSeat(selectedSeat.seatId)}</div>
                <StatusBadge status={selectedSeat.status} />
              </div>
              <button className="drawer-close" onClick={() => setSelectedId(null)}>✕</button>
            </div>

            <div className="drawer-body">
              {selectedSeat.status !== 'VACANT' && (
                <>
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
          <div className="tt-head">HOOD / SEAT {padSeat(tooltipSeat.seatId)}</div>
          {tooltipSeat.status !== 'VACANT' ? (
            <>
              <div className="tt-row">
                <span className="tt-label">OWNER</span>
                <span className="tt-val">{fmtAddr(tooltipSeat.owner!)}</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">PRICE</span>
                <span className="tt-val">{fmtUSDG(tooltipSeat.price!)}</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">COST</span>
                <span className="tt-val">{fmtUSDG(tooltipSeat.weeklyHoldingCost)}/WK</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">STATUS</span>
                <span className="tt-val" style={{
                  color: tooltipSeat.status === 'ACTIVE' ? 'var(--green)'
                    : tooltipSeat.status === 'GRACE' ? 'var(--amber)' : 'var(--red)',
                }}>
                  {tooltipSeat.status}
                </span>
              </div>
            </>
          ) : (
            <div className="tt-row">
              <span className="tt-label">STATUS</span>
              <span className="tt-val" style={{ color: 'var(--t3)' }}>VACANT</span>
            </div>
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
  connected: boolean
}

function ActionModal({
  modal, seat, step, txHash, error,
  newPrice, onNewPrice, prepaid, onPrepaid, topupAmt, onTopupAmt,
  onClose, onConfirm, connected,
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
          <div className="cost-box">
            <div className="crow">
              <span>Takeover price</span>
              <span className="cv">{fmtUSDG(seatPrice)}</span>
            </div>
            <div className="crow">
              <span>Prepaid deposit</span>
              <span className="cv">{fmtUSDG(prepaidRaw)}</span>
            </div>
            <div className="crow tot">
              <span>Total</span>
              <span className="cv">{fmtUSDG(seatPrice + prepaidRaw)}</span>
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
            Balance exhausted and grace period expired.
            Any wallet may foreclose this seat.
          </div>
        </div>
      )
    }

    return null
  }

  function renderSuccess() {
    const actionLabel =
      modal === 'take' ? 'SEAT ACQUIRED' :
      modal === 'takeover' ? 'SEAT TAKEN OVER' :
      modal === 'reprice' ? 'REPRICED' :
      modal === 'topup' ? 'TOPPED UP' : 'FORECLOSED'
    return (
      <div className="share-card">
        <div className="sc-label">HOOD BOARD</div>
        <div className="sc-seat">{padSeat(seat.seatId)}</div>
        <div className="sc-title">{actionLabel}</div>
        {txHash && (
          <div className="sc-row">
            <span>Tx</span>
            <span className="sc-v">{fmtAddr(txHash)}</span>
          </div>
        )}
        {(modal === 'take' || modal === 'takeover') && (
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
