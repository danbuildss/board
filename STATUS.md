# STATUS.md

## Current Phase

**PHASE 1 COMPLETE — PRIVATE BETA READY**

All backend (P0–P7) and frontend finishing (P9–P14) work is done.
System is ready for private beta testing with real users on testnet.

---

## Completed

### Backend + Contracts (P0–P7)

- `PRODUCT.md`, `BUILD_SPEC.md`, `CLAUDE.md`, `DECISIONS.md` — locked to Final Product Spec
- `Board.sol` — full Seat state machine (100 Seats, lazy fee accrual, grace/foreclosure, transfer restriction)
- `Board.t.sol` — 73 tests: unit, fuzz (1000 runs), invariant (256×50), full accounting reconciliation
- `DeployTestnet.s.sol` — deploy script with environment variable configuration
- Board.sol deployed to Robinhood Chain testnet (block 98751649)
- TypeScript indexer — event indexer, idempotent, cursor-persisted, rebuildable from genesis
- Next.js backend — 12 REST endpoints, all verified against contract state
- Lifecycle steps 1–9 proven on testnet (take, reprice, top-up, takeover, grace, recovery, second depletion, foreclosure, re-take)
- `BACKEND_PROOF.md` — full lifecycle + reward E2E with tx hashes
- Functional frontend — board grid, seat drawer, take/reprice/top-up/takeover/foreclose flows, activity feed, profile, leaderboard, share card, rewards page
- **Reward accounting contract suite** (2026-08-13):
  - `IRewardAccounting.sol`, `RewardAccounting.sol`, `Board_v2.sol`, `BoardRewardsVault.sol`, `MockStrategyAdapter.sol`, `MockRewardToken.sol`
  - 30 + 24 tests (unit / fuzz / invariant / integration)
- **BoardRegistry.sol + BoardVault.sol** (2026-08-13) — 24 + 23 tests
- **Grand total: 174 / 174 ✅**
- P4 parameterization — env-var driven boardId, all API routes converted
- P5 reward indexer — `reward_deposits`, `seat_reward_state`, `reward_claims` tables + event handlers
- P6 reward API — `/api/boards/[boardId]/rewards`, `/api/boards/[boardId]/seats/[seatId]/rewards`, `/api/profiles/[wallet]/rewards`
- P7 full lifecycle proof — steps 1–9 + reward E2E (R0–R6) on testnet

### Frontend Finishing (P9–P14) — 2026-08-14

- **P9 — Route refactor**: `/board/hood` → `/board/genesis`, board-resolver alias (`genesis` → `hood` DB slug), zero migration
- **P10 — Economic visibility**: Net Carry on seat grid (lime = positive, red = negative); per-seat weekly stats in drawer; 4 core numbers: ASK / WEEKLY COST / COVERAGE / NET CARRY; tape now shows live activity via API; 7D reward deposit stats
- **P11 — Profile + Leaderboard depth**:
  - Profile: Lifetime Rewards banner, Former Seats section (lost-via, date)
  - Leaderboard: Top Earners (total USDG earned) + Longest Holders (total days via hold-time CTE) sections
- **P12 — Takeover experience**:
  - Seat Notifications strip (GRACE / FORECLOSABLE / low-reserve warnings for owned seats)
  - Takeover preview panel: 7D yield / weekly holding cost / net carry per seat
  - "SEAT IS YOURS" success state for take and takeover completions
- **P13 — Simulator admin page** (`/admin/simulator` — not in nav):
  - 6 regime buttons: DEAD · QUIET · NORMAL · HIGH VOLUME · EVENT SPIKE · CRASH
  - Stage yield (owner wallet required) + Collect & Deposit (permissionless)
  - TESTNET · SIMULATED YIELD ONLY badge displayed prominently
- **P14 — Mobile responsive layout**:
  - Mobile nav bar (bottom tabs) replacing hidden desktop nav on small screens
  - Board grid: 10-col → 5-col on mobile
  - Drawer: full-width bottom sheet with `transform: translateY` animation
  - Leaderboard: 2-col grid → 1-col stack
  - Profile stats: 4-col → 2-col
  - Simulator regime grid: 3-col → 2-col
  - Safe area inset support for notch phones

---

## In Progress

**P15 — QA + Private Beta Prep**

- [ ] Update STATUS.md ← this file
- [ ] Update BACKEND_PROOF.md with frontend notes
- [ ] Known issues audit
- [ ] End-to-end testing with multiple wallets on testnet

---

## Blockers

- Remote execution environment egress policy blocks rpc.testnet.chain.robinhood.com:443
  → All write transactions must be run from local machine
- 5+ real users completing full loop required before design polish (CLAUDE.md design phase gate)

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

BoardRegistry.sol:   24 / 24  ✅
BoardVault.sol:      23 / 23  ✅

Grand total:     174 / 174  ✅
```

---

## Known Issues (Audit — 2026-08-14)

1. **Rewards display in USDG, not MRT** — The RewardAccounting contract uses MockRewardToken (MRT) as the reward token in testnet deployment. Frontend formats reward amounts as USDG via `fmtUSDG()`. This is correct for testnet (MRT and USDG both 6 decimals for display purposes) but may need updating if reward token changes pre-mainnet.

2. **`/board/hood` legacy route** — Old route still exists at `apps/web/src/app/(app)/hood/page.tsx`. The `board-resolver` alias handles DB lookup correctly, but the page file is a dead route. Low priority; no user-facing impact.

3. **Board_v2 address not used in frontend seat actions** — The main board grid page uses `BOARD_ADDRESS` (Board.sol original) for take/topup/reprice/foreclose. Board_v2 rewards work through a separate contract. The two are running side-by-side on testnet. Before mainnet launch, these must be unified (use Board_v2 for everything).

4. **Simulator owner-only constraint** — `simulateYield()` on MockStrategyAdapter requires the owner wallet. The simulator page requires connecting the deployer EOA. There is no access control at the page level (anyone can see the page if they know the URL), but the contract will revert for non-owner callers, so no funds at risk.

5. **Tape scroll animation** — The scrolling tape (`.tape-track`) animation duration is hardcoded to `60s`. With 30+ events it runs fine, but with very few events the tape may loop visibly. Cosmetic only.

6. **Net Carry precision** — Weekly reward estimate uses 7D deposit history divided by active seat count. This is a trailing average and may be zero if no reward deposits occurred in the last 7 days (as is typical early in testnet). The display correctly shows `$0.00` in that case.

7. **`weeksRemaining` with price = 0** — If a seat has price=0 (which shouldn't happen per contract logic), `weeksRemaining()` would return Infinity or NaN. Seat notifications guard on `s.price` truthiness, so this is safe.

---

## Next (P15 remaining)

1. End-to-end playtest with multiple wallets:
   - Wallet A takes seat, wallet B takes it over, wallet A takes it back
   - Confirm rewards accrue and are visible on the Rewards page
   - Confirm seat notifications fire correctly (grace, foreclosable)
   - Confirm mobile layout on a real device

2. Share `/admin/simulator` URL with operator — used to cycle through regimes during beta

3. When 5+ real users have completed the full loop: proceed to design polish (CLAUDE.md gate)
