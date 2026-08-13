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
P2  BoardRegistry contract                      ✅ COMPLETE  24 tests  (2026-08-13)
P3  Reward smoothing in BoardVault              ✅ COMPLETE  23 tests  (2026-08-13)
P4  Parameterize HOOD hardcoding                ✅ COMPLETE  (2026-08-13)
    indexer config · API routes → [boardId] · env-var driven
P5  Reward indexer + DB tables                  ✅ COMPLETE  (2026-08-13)
    reward_deposits · seat_reward_state · reward_claims
    RewardDeposited · EarningsBanked · RewardClaimed handlers
P6  Reward API endpoints                        ✅ COMPLETE  (2026-08-13)
    /api/boards/[boardId]/rewards
    /api/boards/[boardId]/seats/[seatId]/rewards
    /api/profiles/[wallet]/rewards
P7  Full lifecycle proof (testnet, incl.        ✅ COMPLETE  (2026-08-13)
    rewards E2E)                                    all 9 steps + reward E2E (R1–R6)
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
- **BoardRegistry.sol + BoardVault.sol** (2026-08-13):
  - `BoardRegistry.sol` — onchain board config store; PENDING/ACTIVE/PAUSED/DEPRECATED status; 24 tests
  - `BoardVault.sol` — linear reward smoothing over configurable `streamDuration`; roll-over on new harvest; 23 tests
  - Grand total: **174 / 174** ✅
- **P4 parameterization** (2026-08-13): indexer config env-var driven; all API routes converted to `/api/boards/[boardId]/` and `/api/boardrooms/[boardId]/`; activity/leaderboard/profiles use `BOARD_ID` env var
- **P5 reward indexer** (2026-08-13): `reward_deposits`, `seat_reward_state`, `reward_claims` tables; `RewardDeposited`, `EarningsBanked`, `RewardClaimed` event handlers; dual-contract log fetching (board + reward accounting)
- **P6 reward API** (2026-08-13): `/api/boards/[boardId]/rewards`, `/api/boards/[boardId]/seats/[seatId]/rewards`, `/api/profiles/[wallet]/rewards`

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

BoardRegistry.sol:
  Registration:    8 / 8   ✅
  Status:          4 / 4   ✅
  Strategy:        4 / 4   ✅
  Views:           4 / 4   ✅
  Fuzz:            4 / 4   ✅  (1000 runs each)
  Total:          24 / 24  ✅

BoardVault.sol:
  NoSmoothing:     4 / 4   ✅
  Smoothing:      11 / 11  ✅
  Constructor:     3 / 3   ✅
  Fuzz:            3 / 3   ✅  (1000 runs each)
  Total:          23 / 23  ✅

Grand total:     174 / 174  ✅
```

---

## Next (in order)

1. **P8 — Frontend updates**: Net Carry display, 4 core numbers per seat (ASK / REALIZED REWARDS / HOLDING COST / NET CARRY), Rewards page, updated nav (BOARD / GENESIS / ACTIVITY / REWARDS / LEADERBOARD / PROFILE), landing page with live 10×10 preview
3. **P9 — Simulator regimes**: MockStrategyAdapter configurable regimes (DEAD / QUIET / NORMAL / HIGH VOLUME / EVENT SPIKE / CRASH)
4. **P10 — User testing**: 5+ real users complete full loop including reward claims
