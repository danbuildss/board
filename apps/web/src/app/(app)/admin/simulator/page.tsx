'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { writeContract, waitForTransactionReceipt } from 'wagmi/actions'
import {
  wagmiConfig, MOCK_STRATEGY_ADDRESS, BOARD_VAULT_ADDRESS, activeChain,
} from '@/lib/config'
import { MOCK_STRATEGY_ABI, BOARD_VAULT_ABI } from '@/lib/abi'
import { fmtUSDG } from '@/lib/format'

type RegimeKey = 'DEAD' | 'QUIET' | 'NORMAL' | 'HIGH_VOLUME' | 'EVENT_SPIKE' | 'CRASH'

const REGIMES: Record<RegimeKey, { label: string; amount: bigint; desc: string; color: string }> = {
  DEAD:        { label: 'DEAD',        amount: 0n,          desc: 'No yield. Simulates dead market.', color: 'var(--t4)' },
  QUIET:       { label: 'QUIET',       amount: 50_000n,     desc: '$0.05 per cycle. Low activity.', color: 'var(--t3)' },
  NORMAL:      { label: 'NORMAL',      amount: 500_000n,    desc: '$0.50 per cycle. Baseline.', color: 'var(--t2)' },
  HIGH_VOLUME: { label: 'HIGH VOLUME', amount: 2_000_000n,  desc: '$2.00 per cycle. Active market.', color: 'var(--status-info)' },
  EVENT_SPIKE: { label: 'EVENT SPIKE', amount: 10_000_000n, desc: '$10.00 per cycle. Burst event.', color: 'var(--amber)' },
  CRASH:       { label: 'CRASH',       amount: 0n,          desc: 'No yield. Stress test scenario.', color: 'var(--red)' },
}

type TxState = { step: 'idle' | 'pending' | 'done' | 'error'; hash?: string; error?: string }

const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? '')
  .split(',').map(a => a.trim().toLowerCase()).filter(Boolean)

export default function SimulatorPage() {
  const { address } = useAccount()
  const isAdmin = !!address && (ADMIN_WALLETS.length === 0 || ADMIN_WALLETS.includes(address.toLowerCase()))
  const [regime, setRegime] = useState<RegimeKey>('NORMAL')
  const [yieldTx, setYieldTx]     = useState<TxState>({ step: 'idle' })
  const [harvestTx, setHarvestTx] = useState<TxState>({ step: 'idle' })

  const current = REGIMES[regime]

  async function stageYield() {
    if (!address) return
    setYieldTx({ step: 'pending' })
    try {
      const hash = await writeContract(wagmiConfig, {
        address: MOCK_STRATEGY_ADDRESS,
        abi: MOCK_STRATEGY_ABI,
        functionName: 'simulateYield',
        args: [current.amount],
        chain: activeChain,
        account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setYieldTx({ step: 'done', hash })
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setYieldTx({ step: 'error', error: err?.shortMessage ?? err?.message ?? String(e) })
    }
  }

  async function collectAndDeposit() {
    if (!address) return
    setHarvestTx({ step: 'pending' })
    try {
      const hash = await writeContract(wagmiConfig, {
        address: BOARD_VAULT_ADDRESS,
        abi: BOARD_VAULT_ABI,
        functionName: 'collectAndDeposit',
        args: [],
        chain: activeChain,
        account: address,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      setHarvestTx({ step: 'done', hash })
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setHarvestTx({ step: 'error', error: err?.shortMessage ?? err?.message ?? String(e) })
    }
  }

  if (!address) {
    return (
      <div className="page-scroll">
        <div className="page-inner" style={{ maxWidth: 560 }}>
          <div className="sim-warn">Connect wallet to access this page.</div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="page-scroll">
        <div className="page-inner" style={{ maxWidth: 560 }}>
          <div className="sim-warn">Admin access only. Set NEXT_PUBLIC_ADMIN_WALLETS to allow your wallet.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-scroll">
      <div className="page-inner" style={{ maxWidth: 560 }}>

        <div className="sim-header">
          <div className="sim-title">SIMULATOR</div>
          <div className="sim-badge">TESTNET · SIMULATED YIELD ONLY</div>
        </div>

        <div className="sim-desc">
          Control the MockStrategyAdapter regime. Stage yield as the contract owner, then
          harvest into BoardVault (permissionless). Does not reflect real RWA yield.
        </div>

        {/* Regime selector */}
        <div className="sim-section-label">MARKET REGIME</div>
        <div className="sim-regime-grid">
          {(Object.keys(REGIMES) as RegimeKey[]).map(key => {
            const r = REGIMES[key]
            const active = regime === key
            return (
              <button
                key={key}
                className={`sim-regime-btn${active ? ' active' : ''}`}
                style={active ? { borderColor: r.color, color: r.color } : {}}
                onClick={() => setRegime(key)}
              >
                <span className="srb-label">{r.label}</span>
                <span className="srb-amount" style={{ color: active ? r.color : undefined }}>
                  {fmtUSDG(r.amount)}/cycle
                </span>
              </button>
            )
          })}
        </div>

        <div className="sim-regime-desc">{current.desc}</div>

        {/* Actions */}
        <div className="sim-section-label">ACTIONS</div>
        <div className="sim-actions">

          <div className="sim-action-card">
            <div className="sac-title">1 · STAGE YIELD</div>
            <div className="sac-desc">
              Calls <code>simulateYield({fmtUSDG(current.amount)})</code> on MockStrategyAdapter.
              Owner-only — must connect owner wallet.
            </div>
            <button
              className="sim-btn"
              onClick={stageYield}
              disabled={!address || yieldTx.step === 'pending' || current.amount === 0n}
            >
              {yieldTx.step === 'pending' ? (
                <><span className="spinner" style={{ marginRight: 6 }} />Staging…</>
              ) : current.amount === 0n ? (
                `Stage ${fmtUSDG(current.amount)} (no-op)`
              ) : (
                `Stage ${fmtUSDG(current.amount)}`
              )}
            </button>
            {yieldTx.step === 'done' && (
              <div className="sac-result ok">Staged ✓ · tx {yieldTx.hash?.slice(0, 18)}…</div>
            )}
            {yieldTx.step === 'error' && (
              <div className="sac-result err">{yieldTx.error}</div>
            )}
          </div>

          <div className="sim-action-card">
            <div className="sac-title">2 · COLLECT & DEPOSIT</div>
            <div className="sac-desc">
              Calls <code>collectAndDeposit()</code> on BoardVault. Permissionless — any wallet.
              Harvests pending rewards and streams them into RewardAccounting.
            </div>
            <button
              className="sim-btn"
              onClick={collectAndDeposit}
              disabled={!address || harvestTx.step === 'pending'}
            >
              {harvestTx.step === 'pending' ? (
                <><span className="spinner" style={{ marginRight: 6 }} />Collecting…</>
              ) : (
                'Collect & Deposit'
              )}
            </button>
            {harvestTx.step === 'done' && (
              <div className="sac-result ok">Deposited ✓ · tx {harvestTx.hash?.slice(0, 18)}…</div>
            )}
            {harvestTx.step === 'error' && (
              <div className="sac-result err">{harvestTx.error}</div>
            )}
          </div>

        </div>

        <div className="sim-contracts">
          <div className="sim-section-label">CONTRACTS</div>
          <div className="sim-cline">MockStrategyAdapter · <code>{MOCK_STRATEGY_ADDRESS}</code></div>
          <div className="sim-cline">BoardVault · <code>{BOARD_VAULT_ADDRESS}</code></div>
        </div>

      </div>
    </div>
  )
}
