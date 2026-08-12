# STATUS.md

## Current Phase

**PHASE 1 — PRODUCTIVE SIMULATOR** *(transitioning from Phase 0 — Backend Proof)*

Engineering priority (BUILD_SPEC.md P0–P7):

```
P0  Base Seat engine              ✅ COMPLETE (73/73 tests)
P1  Parameterize HOOD hardcoding  🔲 TODO
P2  Reward accounting contracts   🔲 TODO
P3  Reward indexer + DB tables    🔲 TODO
P4  Reward API endpoints          🔲 TODO
P5  Full lifecycle proof incl.    🟡 7/9 scenarios — steps 8–9 time-gated
    rewards E2E
P6  Functional frontend           ✅ COMPLETE (merged PR #4)
P7  User testing                  🔲 TODO
```

---

## Completed

- `PRODUCT.md`, `BUILD_SPEC.md`, `CLAUDE.md`, `DECISIONS.md` — updated to new Master Product + Build Spec (2026-08-12)
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
- Functional frontend (`apps/web`) — board grid, seat drawer, take/reprice/top-up/takeover flows, activity feed, profile, leaderboard, boardroom access gate, share card

---

## Blockers

- **Lifecycle steps 8–9 time-gated**: grace expires 2026-08-12T15:03:15Z UTC
  → Run `forecloseSeat` then `takeVacantSeat` from local machine today (commands in `BACKEND_PROOF.md`)
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

1. **Today — run steps 8–9** from local machine after 15:03:15Z UTC (commands in `BACKEND_PROOF.md`)
2. Paste tx hashes into `BACKEND_PROOF.md`, mark status COMPLETE, update P5 → ✅
3. **P1** — Remove HOOD hardcoding: parameterize `boardId` in indexer config, API routes, frontend
4. **P2** — Write, test, and deploy new contracts:
   - `MockRewardToken.sol`, `MockStrategyAdapter.sol`, `BoardRewardsVault.sol`, `RewardAccounting.sol`, `Board_v2.sol`
5. **P3/P4** — Extend indexer (3 new event handlers, 3 new DB tables) and API (3 new endpoints)
6. **P5** — Reward UI: board revenue header, seat earnings panel, profile claim action
7. **P7** — 5+ real users complete full loop including claims
