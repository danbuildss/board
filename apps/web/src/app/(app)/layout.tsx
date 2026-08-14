'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { useQuery } from '@tanstack/react-query'
import { fmtAddr, fmtTimestamp, eventLabel, padSeat } from '@/lib/format'
import { CHAIN_ID } from '@/lib/config'

type TapeEvent = {
  event_type: string
  seat_id: number
  new_price: string | null
  occurred_at: string | null
}

function WalletBtn() {
  const { login, logout, authenticated } = usePrivy()
  const { address } = useAccount()

  if (authenticated && address) {
    return (
      <button className="wbtn connected" onClick={logout}>
        <span className="wdot" />
        {fmtAddr(address)}
      </button>
    )
  }
  return (
    <button className="wbtn" onClick={login}>
      Connect Wallet
    </button>
  )
}

function Tape() {
  const { data } = useQuery<{ activity: TapeEvent[] }>({
    queryKey: ['tape'],
    queryFn: () => fetch('/api/activity?limit=30').then(r => r.json()),
    refetchInterval: 15_000,
  })
  const items = data?.activity ?? []
  const doubled = [...items, ...items]

  if (items.length === 0) return <div className="shell-tape" />

  return (
    <div className="shell-tape">
      <div className="tape-track">
        {doubled.map((ev, i) => (
          <span key={i} className="tape-event">
            <span className="te-seat">{padSeat(ev.seat_id)}</span>
            <span className="te-type">{eventLabel(ev.event_type)}</span>
            {ev.new_price ? ` $${(+ev.new_price / 1_000_000).toFixed(0)}` : ''}
            {ev.occurred_at ? `  ${fmtTimestamp(ev.occurred_at)}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

const NAV_LINKS = [
  { href: '/board/genesis', label: 'BOARD' },
  { href: '/activity',      label: 'ACTIVITY' },
  { href: '/rewards',       label: 'REWARDS' },
  { href: '/leaderboard',   label: 'LBOARD' },
  { href: '/about',         label: 'ABOUT' },
]

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav className="mobile-nav">
      {NAV_LINKS.map(n => (
        <Link
          key={n.href}
          href={n.href}
          className={`mob-link${pathname === n.href || pathname.startsWith(n.href + '/') ? ' active' : ''}`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { chainId } = useAccount()
  const wrongChain = !!chainId && chainId !== CHAIN_ID

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-logo">
          <Link href="/">BOARD</Link>
          <span className="shell-badge">GENESIS · 100 SEATS</span>
        </div>
        <nav className="shell-nav">
          {NAV_LINKS.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-link${pathname === n.href || pathname.startsWith(n.href + '/') ? ' active' : ''}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <WalletBtn />
      </header>

      {wrongChain && (
        <div className="network-warn">
          ⚠ Wrong network — switch to Robinhood Chain Testnet (chain 46630)
        </div>
      )}

      <div className="shell-body">
        {children}
      </div>

      <Tape />
      <MobileNav pathname={pathname} />
    </div>
  )
}
