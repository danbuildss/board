# STATUS.md

## Current Phase

**PHASE 1 — PRODUCTIVE SIMULATOR**

Final product spec locked 2026-08-13. One Board, 100 Seats, Mock Strategy, real mechanics, terminal UI.

Engineering priority:

```
P0  Base Seat engine (Board.sol)                ✅ COMPLETE  73/73 tests
P1  Reward accounting contracts                 ✅ COMPLETE  54 new tests (30 + 24)
    Board_v2/BoardCore · RewardAccounting
    BoardVault · MockStrategyAdapter
P2  BoardRegistry contract                      🔲 TODO
P3  Reward smoothing in BoardVault              🔲 TODO
P4  Parameterize HOOD hardcoding                🔲 TODO
P5  Reward indexer + DB tables                  🔲 TODO
P6  Reward API endpoints                        🔲 TODO
P7  Full lifecycle proof (testnet, incl.        🟡 7/9 base scenarios done
    rewards E2E)                                    steps 8–9 + rewards need local machine
P8  Functional frontend updates                 🔲 TODO  (base frontend ✅ merged PR #4)
    Net Carry · 4 core numbers · Rewards page
    New nav structure · Landing page
P9  Simulator regimes                           🔲 TODO
    DEAD · QUIET · NORMAL · HIGH VOLUME · EVENT SPIKE · CRASH
P10 User testing (5+ real users, full loop)     🔲 TODO
```

---

## Completed

- `PRODUCT.md`, `BUILD_SPEC.md`, `CLAUDE.md`, `DECISIONS.md` — docs updated to Final Product Spec (2026-08-13)
- `Board.sol` — full Seat state machine (100 Seats, lazy fee accrual, grace/foreclosure, transfer restriction)
- `Board.t.sol` — 73 tests: unit, fuzz (1000 runs), invariant (256×50), full accounting reconciliation
- `DeployTestnet.s.sol` — deploy script with environment variable configuration
- Board.sol deployed to Robinhood Chain testnet (block 98751649)
- TypeScript indexer — event indexer, idempotent, cursor-persisted, rebuildable from genesis
- Next.js backend — 9 REST endpoints, all verified against contract state
- Lifecycle steps 1–7 proven on testnet (take, reprice, top-up, takeover, grace, recovery, second depletion)
- `BACKEND_PROOF.md` — populated with network, contracts, tests, API, steps 1–7 tx hashes
- Functional frontend (`apps/web`) — board grid, seat drawer, take/reprice/top-up/takeover/foreclose flows, activity feed, profile, leaderboard, share card
- **Reward accounting contract suite** (2026-08-13, branch `claude/new-product-workflow-check-mw96bb`):
  - `IRewardAccounting.sol` — lifecycle hook interface
  - `RewardAccounting.sol` — WAD-precision globalIndex engine; ACTIVE earns, GRACE pauses, transfers bank atomically
  - `Board_v2.sol` — standalone Board with lazy grace detection (`_syncGraceHook`) and reward hooks; backward-compatible (`ra == address(0)` = no-op)
  - `BoardRewardsVault.sol` — orchestrates strategy harvest → ra.deposit; permissionless
  - `MockStrategyAdapter.sol` — simulateYield + harvest for test scenarios
  - `MockRewardToken.sol` — mintable ERC-20 for testing
  - `RewardAccounting.t.sol` — 30 tests (unit / fuzz / invariant)
  - `Board_v2.t.sol` — 24 integration tests (all lifecycle paths, vault flow, fuzz)

---

## Blockers

- Remote execution environment egress policy blocks rpc.testnet.chain.robinhood.com:443
  → All write transactions (testnet deploy, lifecycle proof steps 8–9, reward E2E) must be run from local machine

---

## Tests

```
Board.sol:
  Unit:           62 / 62  ✅
  Fuzz:            7 / 7   ✅  (1000 runs each)
  Invariant:       4 / 4   ✅  (256 runs × 50 depth)
  Total:          73 / 73  ✅

RewardAccounting.sol:
  Unit:           17 / 17  ✅
  Fuzz:            3 / 3   ✅  (1000 runs each)
  Invariant:       3 / 3   ✅
  Admin:           7 / 7   ✅
  Total:          30 / 30  ✅

Board_v2.sol (integration):
  Admin:           3 / 3   ✅
  TakeVacant:      4 / 4   ✅
  TopUp:           3 / 3   ✅
  SetPrice:        2 / 2   ✅
  Takeover:        4 / 4   ✅
  Foreclose:       3 / 3   ✅
  VaultFlow:       4 / 4   ✅
  Fuzz:            1 / 1   ✅  (1000 runs)
  Total:          24 / 24  ✅

Grand total:     127 / 127  ✅
```

---

## Next (in order)

1. **P2 — BoardRegistry.sol**: store board config onchain (boardId, name, market symbol, seat count, settlement asset, reward asset, strategy adapter, vacant price, holding rate, grace period, status)
2. **P3 — Reward smoothing**: BoardVault streams realized revenue over a configurable interval rather than depositing in one block — reduces MEV and reward sniping
3. **P4 — Parameterize HOOD hardcoding**: replace hardcoded `boardId` in indexer config, API routes, and frontend with `BoardRegistry` lookup
4. **P5 — Indexer + DB**: 3 new tables (`reward_deposits`, `seat_reward_state`, `reward_claims`), 3 new event handlers
5. **P6 — API endpoints**: `/api/boards/:boardId/rewards`, `/api/boards/:boardId/seats/:seatId/rewards`, `/api/profiles/:wallet/rewards`
6. **P7 — Testnet lifecycle proof**: deploy Board_v2 suite, run steps 8–9 (foreclose + retake), run reward E2E (deposit → accrue → bank → claim) — requires local machine
7. **P8 — Frontend updates**: Net Carry display, 4 core numbers per seat, Rewards page, updated nav (BOARD / GENESIS / ACTIVITY / REWARDS / LEADERBOARD / PROFILE), landing page with live 10×10 preview
8. **P9 — Simulator regimes**: MockStrategyAdapter configurable regimes (DEAD / QUIET / NORMAL / HIGH VOLUME / EVENT SPIKE / CRASH)
9. **P10 — User testing**: 5+ real users complete full loop including reward claims
