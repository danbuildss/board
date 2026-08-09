# BACKEND_PROOF.md

**Status: INCOMPLETE — Phase 1 not yet proven.**

This document will be completed before any frontend polish begins.
See `CLAUDE.md` → "Backend Proof Requirement" and `BUILD_SPEC.md` → "Testnet Proof Milestone".

---

## Network

```
Network:          —
Chain ID:         —
RPC/provider:     —
Deployment block: —
Settlement asset: —
```

---

## Contracts

```
Board.sol:  —
```

---

## Tests

```
Unit:        — passing / — total
Fuzz:        — passing / — total
Invariant:   — passing / — total
Integration: — passing / — total
```

---

## Real Testnet Lifecycle

Transaction hashes:

| # | Action | Tx Hash | Notes |
|---|---|---|---|
| 1 | Take vacant Seat #07 (Wallet A) | — | — |
| 2 | Reprice Seat #07 ($40 → $80) | — | — |
| 3 | Top-up Seat #07 | — | — |
| 4 | Takeover Seat #07 (Wallet B) | — | — |
| 5 | Seat #07 enters grace | — | — |
| 6 | Grace recovery (Wallet B tops up) | — | — |
| 7 | Second depletion | — | — |
| 8 | Foreclosure (Wallet C) | — | — |
| 9 | Seat #07 taken again (Wallet D) | — | — |

---

## Accounting

_To be filled: before/after balances for all wallets and protocol treasury across the lifecycle above._

---

## Indexer

- [ ] Restart proven
- [ ] Replay proven
- [ ] Duplicate event handling proven
- [ ] Full rebuild proven

---

## API

- [ ] API state matches contract state at each lifecycle step

---

## Known Issues

_None yet — will be listed openly when discovered._
