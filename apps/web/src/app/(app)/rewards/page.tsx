'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { fmtUSDG, fmtAddr, padSeat } from '@/lib/format'

type BoardRewards = {
  totalDeposited: string
  globalIndex: string
  activeSeatCount: number
  recentDeposits: Array<{
    amount: string
    globalIndexAfter: string
    activeSeatCount: number
    blockNumber: number
    txHash: string
    depositedAt: string
  }>
}

type WalletRewards = {
  totalClaimed: string
  activeSeatsAccruing: Array<{
    seatId: number
    pendingEstimate: string
    cumulativeBanked: string
  }>
}

export default function RewardsPage() {
  const { address } = useAccount()

  const { data: boardRewards, isLoading: boardLoading } = useQuery<BoardRewards>({
    queryKey: ['board-rewards'],
    queryFn: () => fetch('/api/boards/hood/rewards').then(r => r.json()),
    refetchInterval: 30_000,
  })

  const { data: walletRewards } = useQuery<WalletRewards>({
    queryKey: ['wallet-rewards', address],
    queryFn: () => fetch(`/api/profiles/${address}/rewards`).then(r => r.json()),
    enabled: !!address,
    refetchInterval: 30_000,
  })

  return (
    <div className="page-scroll">
      <div className="page-inner rw-page">

        <div className="rw-header">
          <div className="rw-title">REWARDS</div>
          <div className="rw-sub">HOOD Board · Realized seat earnings</div>
        </div>

        {/* Board-level stats */}
        <div className="rw-section">
          <div className="rw-section-label">BOARD TOTALS</div>
          {boardLoading ? (
            <div className="empty-state"><span className="spinner" /></div>
          ) : boardRewards ? (
            <div className="rw-stat-row">
              <div className="rw-stat">
                <div className="rw-stat-label">TOTAL DEPOSITED</div>
                <div className="rw-stat-val">{fmtUSDG(boardRewards.totalDeposited)}</div>
              </div>
              <div className="rw-stat">
                <div className="rw-stat-label">ACTIVE SEATS</div>
                <div className="rw-stat-val">{boardRewards.activeSeatCount}</div>
              </div>
            </div>
          ) : (
            <div className="empty-state dim">No reward data</div>
          )}
        </div>

        {/* Connected wallet */}
        {address ? (
          <div className="rw-section">
            <div className="rw-section-label">YOUR REWARDS</div>
            {walletRewards ? (
              <>
                <div className="rw-stat-row">
                  <div className="rw-stat">
                    <div className="rw-stat-label">TOTAL CLAIMED</div>
                    <div className="rw-stat-val g">{fmtUSDG(walletRewards.totalClaimed)}</div>
                  </div>
                  <div className="rw-stat">
                    <div className="rw-stat-label">ACTIVE SEATS</div>
                    <div className="rw-stat-val">{walletRewards.activeSeatsAccruing.length}</div>
                  </div>
                </div>
                {walletRewards.activeSeatsAccruing.length > 0 && (
                  <div className="rw-seat-list">
                    <div className="rw-seat-hdr">
                      <span>SEAT</span>
                      <span>BANKED</span>
                    </div>
                    {walletRewards.activeSeatsAccruing.map(s => (
                      <div key={s.seatId} className="rw-seat-row">
                        <Link href="/hood" className="rw-seat-id">
                          {padSeat(s.seatId)}
                        </Link>
                        <span className="rw-seat-val g">{fmtUSDG(s.cumulativeBanked)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state dim">Loading…</div>
            )}
          </div>
        ) : (
          <div className="rw-section">
            <div className="empty-state dim">Connect wallet to see your rewards</div>
          </div>
        )}

        {/* Recent deposits */}
        {boardRewards?.recentDeposits && boardRewards.recentDeposits.length > 0 && (
          <div className="rw-section">
            <div className="rw-section-label">RECENT DEPOSITS</div>
            <div className="rw-deposit-list">
              <div className="rw-deposit-hdr">
                <span>BLOCK</span>
                <span>AMOUNT</span>
                <span>ACTIVE SEATS</span>
              </div>
              {boardRewards.recentDeposits.map((d, i) => (
                <div key={i} className="rw-deposit-row">
                  <span className="dim">{d.blockNumber.toLocaleString()}</span>
                  <span className="g">{fmtUSDG(d.amount)}</span>
                  <span className="dim">{d.activeSeatCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
