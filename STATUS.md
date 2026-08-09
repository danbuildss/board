# STATUS.md

## Current Phase

**PHASE 1 — BACKEND PROOF**

P0 Contracts     — ✅ COMPLETE
P1 Contract Tests — ✅ COMPLETE (73/73 pass)
P2 Testnet Deploy — ✅ COMPLETE (Board: 0x0a3932a24dCC9Bbd7BFC448Da99265EC58F806DB, block 98751649)
P3 Indexer        — ✅ COMPLETE (TypeScript, viem, Postgres, idempotent, rebuildable)
P4 Backend API    — ✅ COMPLETE (9 endpoints live at https://board-fun.vercel.app)
P5 Lifecycle Proof — 🟡 7/9 scenarios proven — steps 8–9 blocked until 2026-08-12T15:03:15Z

---

## Completed

- `PRODUCT.md` — full Master Product Brief
- `BUILD_SPEC.md`, `CLAUDE.md`, `DECISIONS.md`, `NOTES.md` written
- Repo structure initialized
- `Board.sol` — full HOOD state machine (100 Seats, lazy fee accrual, grace/foreclosure, transfer restriction)
- `Board.t.sol` — 73 tests: unit, fuzz (1000 runs), invariant (256×50), full accounting reconciliation
- `DeployTestnet.s.sol` — deploy script with environment variable configuration
- Board deployed to Robinhood Chain testnet (block 98751649)
- TypeScript indexer — event indexer, idempotent, cursor-persisted, rebuildable from genesis
- Next.js backend — 9 REST endpoints, all verified against contract state
- Lifecycle steps 1–7 proven on testnet (take, reprice, top-up, takeover, grace, recovery, second depletion)
- wagmi v3 + tanstack-query v5 wired into `apps/web`
- `BACKEND_PROOF.md` — populated with network, contracts, tests, API, steps 1–7 tx hashes

---

## Blockers

- **Steps 8–9 time-gated**: grace period expires 2026-08-12T15:03:15Z UTC
  → Run `forecloseSeat` then `takeVacantSeat` from local machine on Aug 12 (commands in BACKEND_PROOF.md)
- Remote execution environment egress policy blocks rpc.testnet.chain.robinhood.com:443
  → All write transactions must be sent from local machine

---

## Tests

```
Unit:       62 / 62  ✅
Fuzz:        7 / 7   ✅  (1000 runs each)
Invariant:   4 / 4   ✅  (256 runs × 50 depth = 12,800 calls/invariant)
Integration: 0       (testnet manual lifecycle serves as integration proof)
Total:      73 / 73  ✅
```

---

## Next

1. **Aug 12 — run steps 8–9** from local machine (commands in `BACKEND_PROOF.md`)
2. Paste tx hashes into `BACKEND_PROOF.md` and mark status COMPLETE
3. Declare backend proven → start P6 functional frontend
