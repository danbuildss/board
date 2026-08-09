// Mirrors Board.sol's deterministic state derivation.
// All values from DB are NUMERIC → stored as strings in pg.

const NUM  = 5n;
const DEN  = 1000n;
const WEEK = 604800n;
const GRACE = 259200n; // 72 hours

function toBigInt(val: string | null | undefined): bigint {
  if (!val) return 0n;
  // NUMERIC may have decimals — take integer part
  return BigInt(val.split('.')[0]);
}

export type SeatStatus = 'VACANT' | 'ACTIVE' | 'GRACE' | 'FORECLOSABLE';

export interface SeatRow {
  owner: string | null;
  price: string | null;
  prepaid_balance: string | null;
  last_settled_at: Date | null;
}

export function deriveStatus(seat: SeatRow): SeatStatus {
  if (!seat.owner || !seat.price || !seat.prepaid_balance || !seat.last_settled_at) {
    return 'VACANT';
  }

  const price   = toBigInt(seat.price);
  const prepaid = toBigInt(seat.prepaid_balance);
  const lastTs  = BigInt(Math.floor(seat.last_settled_at.getTime() / 1000));
  const nowTs   = BigInt(Math.floor(Date.now() / 1000));
  const elapsed = nowTs - lastTs;

  const accrued = (price * NUM * elapsed) / (DEN * WEEK);

  if (accrued < prepaid) return 'ACTIVE';

  // Balance exhausted — compute depletion time
  const depletion = price > 0n
    ? lastTs + (prepaid * DEN * WEEK) / (price * NUM)
    : lastTs;
  const graceEnd = depletion + GRACE;

  if (nowTs <= graceEnd) return 'GRACE';
  return 'FORECLOSABLE';
}

export function effectiveBalance(seat: SeatRow): bigint {
  if (!seat.price || !seat.prepaid_balance || !seat.last_settled_at) return 0n;

  const price   = toBigInt(seat.price);
  const prepaid = toBigInt(seat.prepaid_balance);
  const lastTs  = BigInt(Math.floor(seat.last_settled_at.getTime() / 1000));
  const nowTs   = BigInt(Math.floor(Date.now() / 1000));
  const elapsed = nowTs - lastTs;

  const accrued = (price * NUM * elapsed) / (DEN * WEEK);
  return accrued >= prepaid ? 0n : prepaid - accrued;
}

export function weeklyHoldingCost(price: string | null): bigint {
  if (!price) return 0n;
  return (toBigInt(price) * NUM) / DEN;
}

export function estimatedDepletionAt(seat: SeatRow): Date | null {
  if (!seat.price || !seat.prepaid_balance || !seat.last_settled_at) return null;
  const price   = toBigInt(seat.price);
  const prepaid = toBigInt(seat.prepaid_balance);
  if (price === 0n) return null;
  const lastTs  = BigInt(Math.floor(seat.last_settled_at.getTime() / 1000));
  const dep = lastTs + (prepaid * DEN * WEEK) / (price * NUM);
  return new Date(Number(dep) * 1000);
}
