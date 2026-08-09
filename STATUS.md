# STATUS.md

## Current Phase

**PHASE 1 — BACKEND PROOF**

P0 Contracts — ✅ COMPLETE
P1 Contract Tests — ✅ COMPLETE (73/73 pass)
P2 Testnet Deployment — ✅ COMPLETE (Board: 0x0a3932a24dCC9Bbd7BFC448Da99265EC58F806DB, block 98751649)
P3 Indexer — ✅ COMPLETE (TypeScript, viem, Postgres, idempotent, rebuildable)
P4 Backend API — in progress
P5 End-to-End Lifecycle Proof — not started

---

## Completed

- `PRODUCT.md` written
- `BUILD_SPEC.md` written
- `CLAUDE.md` written
- `NOTES.md` written
- Repo structure initialized
- `Board.sol` — full HOOD state machine (100 Seats, lazy fee accrual, grace/foreclosure, transfer restriction)
- `Board.t.sol` — 73 tests: unit, fuzz (1000 runs), invariant (256×50), full accounting reconciliation
- `DeployBoard.s.sol` — deploy script
- Foundry project initialized (OZ v5.7, forge-std v1.16)

---

## In Progress

P2 — Testnet deployment to Robinhood Chain

---

## Blockers

- Remote execution environment egress policy blocks rpc.testnet.chain.robinhood.com:443
  → P2 deploy must be run locally (all scripts ready)

---

## Tests

```
Unit:       62 / 62  ✅
Fuzz:        7 / 7   ✅  (1000 runs each)
Invariant:   4 / 4   ✅  (256 runs × 50 depth = 12,800 calls/invariant)
Integration: 0       (planned post-testnet)
Total:      73 / 73  ✅
```

---

## Next

1. Run deployment from local machine (see deploy guide below)
2. Record Board address + deploy block in `BACKEND_PROOF.md`
3. Fund 2 test wallets with testnet USDG from https://faucet.paxos.com/?network=robinhood
4. Run 8-scenario manual lifecycle (take → reprice → takeover → grace → recovery → foreclose → retake)
5. Start P3 indexer (`services/indexer/`)
