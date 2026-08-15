export const DECIMALS = 6
export const SCALE = 1_000_000n

export function fmtUSDG(raw: string | bigint | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '$0.00'
  const n = typeof raw === 'bigint' ? raw : BigInt(String(raw).split('.')[0])
  const whole = n / SCALE
  const frac  = n % SCALE
  return `$${whole}.${frac.toString().padStart(6, '0').slice(0, 2)}`
}

export function parseUSDG(dollars: number): bigint {
  const cents = Math.round(dollars * 1_000_000)
  return BigInt(cents)
}

export function fmtAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function padSeat(id: number | string): string {
  return `#${String(id).padStart(3, '0')}`
}

export function minDeposit(priceRaw: bigint, weeks = 2n): bigint {
  return (priceRaw * 5n * weeks) / 1000n
}

export function weeklyFee(priceRaw: bigint): bigint {
  return (priceRaw * 5n) / 1000n
}

export function weeksRemaining(balance: bigint, price: bigint): string {
  if (price === 0n || balance === 0n) return '0'
  const weekly = weeklyFee(price)
  if (weekly === 0n) return '0'
  const x = Number((balance * 10n) / weekly) / 10
  return x.toFixed(1)
}

export function fmtTimestamp(isoStr: string | null | undefined): string {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function fmtDate(isoStr: string | null | undefined): string {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export function eventLabel(type: string): string {
  switch (type) {
    case 'SeatAcquired':    return 'ACQUIRED'
    case 'SeatTaken':       return 'TAKEOVER'
    case 'SeatPriceChanged': return 'REPRICED'
    case 'SeatToppedUp':    return 'TOPPED UP'
    case 'SeatForeclosed':  return 'FORECLOSED'
    case 'EarningsBanked':  return 'EARNED'
    case 'RewardClaimed':   return 'CLAIMED'
    case 'RewardDeposited': return 'REWARD IN'
    default:                return type.toUpperCase()
  }
}
