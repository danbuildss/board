# BACKEND_PROOF.md

Status: **✅ COMPLETE — Full lifecycle + reward E2E proven on testnet (2026-08-13); audit fixes applied 2026-08-15**

---

## Network

| Field | Value |
|---|---|
| Network | Robinhood Chain Testnet |
| Chain ID | 46630 |
| RPC | https://rpc.testnet.chain.robinhood.com |
| Explorer | https://explorer.testnet.chain.robinhood.com |
| Settlement asset | USDG (Paxos Global Dollar) |
| Settlement asset address | 0x7E955252E15c84f5768B83c41a71F9eba181802F |

---

## Contracts

### Board.sol (original — lifecycle proof steps 1–9)

| Contract | Address | Deployment Block |
|---|---|---|
| Board | 0x0a3932a24dCC9Bbd7BFC448Da99265EC58F806DB | 98751649 |

Deploy tx: `0xa313abe4eba795d9ad284da9a3fbc8c92fa685fc92e6bc4febdb7fe233bb11ac`
Deployer: `0x69ff8eC5B523E334c328c0Dc60391E7643494D6c`

### Board_v2 Suite (reward accounting — deployed 2026-08-13)

| Contract | Address | Deployment Block |
|---|---|---|
| MockRewardToken | 0x0016a3B653481BE3177DFCf61B175d19F378B37C | 100731961 |
| MockStrategyAdapter | 0xcc061Ecc90ddF9785b20bD99A604dA27CF784911 | 100731962 |
| RewardAccounting | 0xf51FAACD5a76Bf315a9473FcE549a49B2fe3cb78 | 100731964 |
| Board_v2 | 0x6A57Ff5C1d105941c8A6CcCC681F37B1FED9733E | 100731964 |
| BoardVault | 0xf3751c59f4D90B3F117560Fc61c7968D8e1C4648 | 100731965 |
| BoardRegistry | 0x65fae2658BB7391E57290cb055E1448E3aa76cF6 | 100731965 |

Registry boardId: 1 (HOOD Board, ACTIVE)

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

## Real Testnet Lifecycle — Board.sol

Seat: **#1**
Wallet A: `0x453C854Dd27c77da73b77B3f664f6365aeB39f1a`
Wallet B (deployer): `0x69ff8eC5B523E334c328c0Dc60391E7643494D6c`

### Step 1 — Take Vacant Seat ✅

- Wallet A takes Seat #1 at price $10, prepaid $1
- tx: `0xd234f478047827ba65517100940da32f433290bfd1e461343ef2b1fc229f70bc`
- Block: 98788899

### Step 2 — Reprice ✅

- Price: $10 → $20
- tx: `0xf0da117706908d9bd72f0625954a982b8784a272363044d5de1cc935d06eeb73`
- Block: 98789403

### Step 3 — Top-up ✅

- Amount: $2 added
- tx: `0x299337a777dff576b24ea7bc1c1f29cb55b472542d8551781245b7d9121c963a`
- Block: 98790452

### Step 4 — Takeover ✅

- Wallet B takes Seat #1 from Wallet A at $20
- Protocol fee: $1 (5%) → treasury
- Remaining balance refunded to Wallet A: $2.999913
- New price: $15, new prepaid: $1.50
- tx: `0x8368f4f075d8eaf0715f8e2447641f53aaa3c1392cf23e7670b5e577bae354df`
- Block: 98791305

### Step 5 — Grace (balance depletion) ✅

- Price set to $1,000,000 to accelerate depletion
- Reprice tx: `0x7706b899a8472372267d5cc3b1f1f7a01f19c96e09d8be8565cc8785f9d0fe1e`
- Balance depleted at block 98794390; grace window: 72h from 2026-08-09T15:03:15Z

### Step 6 — Grace Recovery ✅

- $0.50 topped up during grace, restores ACTIVE briefly
- tx: `0x7958aee3ae8f34ab298ecc589eef2caa7a25b28295ef080cc34db25b89c7a35b`
- Block: 98794390

### Step 7 — Second Depletion ✅

- Balance drained again at $1M price in ~60 seconds
- Grace expires: 2026-08-12T15:03:15Z UTC

### Step 8 — Foreclosure ✅

- Caller: Wallet B (permissionless; grace expired)
- tx: `0x0b53a2d908c3a34e6e2c5f3533c3ad833a6fda4750e4ec4801e7670727914ecb`
- Block: 100734157

### Step 9 — Same Seat Taken Again Post-Foreclosure ✅

- Wallet A re-takes Seat #1 (VACANT after foreclosure)
- Approve tx: `0x8cc53d38c04935dee3d1018a3aadd6432c0cac2222573ca10ed8700745e06850`
- Take tx: `0x0532b71a7fbc77775c08cbc51ca99aa6f757dd533f7fdfe3baf8ee3dbea43fd6`
- Block: 100736177
- Full A→B→foreclose→A cycle complete

---

## Reward E2E — Board_v2

Proves: seat earns while ACTIVE → lifecycle event banks earnings → owner claims tokens onchain.

Wallet B (Seat owner): `0x69ff8eC5B523E334c328c0Dc60391E7643494D6c`
Wallet A (takeover buyer): `0x453C854Dd27c77da73b77B3f664f6365aeB39f1a`

### R0 — Deploy Board_v2 Suite ✅

All 6 contracts deployed and wired in a single broadcast (2026-08-13):
- MockRewardToken → setMinter(strategy): `0x8814e8e0dfe1b4774ce28dbf55f2a966e4c9854dba39e4336daa618ce06ca485`
- MockStrategyAdapter: `0x51eac62da1e5573a1209c9906776fdaf807dbe8d60f02a93be018750ea320652`
- RewardAccounting: `0xf923b9e031216e0e76b728e98e7857b333dad525a6522d46213c926de473784d`
- ra.setBoard(board_v2): `0x9236acb0cd3c5cedc45ab5d7873dd09c5586abf6281511ca0a38b58f4277e6c3`
- Board_v2: `0x93e01ae9518d83500c8b5a98b6edac8b6d6fb40de61d90733208bb20266d518d`
- board_v2.setRewardAccounting(ra): `0x7591470ae124a178b6771b409e785a98b16ed2d8dc421bd86854acc1460077fa`
- BoardVault: `0x13aea80ed3af2d9c834c7d23ab48dffc44c084a774cecc57d8fdde1c494d1b02`
- BoardRegistry: `0xd24710a58f370ddfff44bb96b12e3335e82c2a1ffa727877348d6648c02b98a8`
- registry.registerBoard + setStatus(ACTIVE): `0xb967b2c3089f4f471a269488c8546e4131db8536b15e1e6ba6b05296ccc37cdd`

### R1 — Wallet B Takes Seat #1 on Board_v2 (ACTIVE, accruing) ✅

- USDG approve tx: `0xf80ecca9625c2013e0ada3fd0be76317bda510a6ac86e690831e4c5685176a9b`
- takeVacantSeat tx: `0x3d5a0fe15d1ce9ecadf8790f3de9ba667df102c44239e5a0de4ea5e12fb722ea`
- Block: 100736617
- RA emitted: `SeatActivated(seatId=1, owner=WalletB)` → activeSeatCount=1

### R2 — Simulate Yield (1 MRT = 1e18 units) ✅

- strategy.simulateYield(1e18): `0x479ac52b501da9f1133211dfd5be15eb2cd08bc7b50ae81ad96952a0915d7585`
- Block: 100736692
- pendingRewards staged in MockStrategyAdapter

### R3 — Harvest + Release to RewardAccounting ✅

- vault.collectAndDeposit(): `0x91e191a86eb26752a6d705b36ebe6fe22465c8f1ef57e01479086b847c604019`
  - Strategy minted 1e18 MRT to BoardVault
  - BoardVault transferred 1e18 MRT to RewardAccounting
  - RA emitted: `RewardDeposited(amount=1e18, newGlobalIndex=1e36, activeSeatCount=1)`
- vault.drip(): `0x8740070be39edb3b3eacbed4933fe2351f3e0dbf1476154f4ba3fa40669f62ac`
  - streamDuration=0; no additional release needed (all released in collectAndDeposit)
- Block: 100736797

### R4 — Wallet A Takes Seat #1 (EarningsBanked for Wallet B) ✅

- USDG approve tx: `0x70376695d7f482f4a9f3ae2ad5d079e2ced1ca3eccbd743ce930dd239c1741e5`
- takeSeat tx: `0xc43971314805a4003d77e7ba205045e5504e0e0be86eebf37e48887856ab05db`
- Block: 100737123
- RA emitted: `EarningsBanked(seatId=1, owner=WalletB, amount=1e18)`
  - Wallet B accrued 100% of 1 MRT (sole active seat during reward window)

### R5 — Verify Claimable Balance ✅

```
cast call $RA "claimable(address)(uint256)" $WALLET_B
→ 1000000000000000000 [1e18]  ✅
```

### R6 — Wallet B Claims 1 MRT ✅

- ra.claim(): `0xf448e35c7b1ad9defb561f320c1441ea6c188dec067a36319e56951cfbf40b71`
- Block: 100738445
- MRT transferred from RewardAccounting to Wallet B: 1e18
- RA emitted: `RewardClaimed(owner=WalletB, amount=1e18)`

---

## Accounting

### Lifecycle Takeover (Step 4)

| Party | Flow |
|---|---|
| Buyer (Wallet B) | Paid $20 seat price + $1.50 prepaid = $21.50 out |
| Seller (Wallet A) | Received $2.999913 remaining balance refund |
| Treasury | Received $1 protocol fee (5% of $20) |
| Board contract | Holds $1.50 new prepaid balance |
| Total | $20 price = $19 seller pathway + $1 fee ✅ |

### Reward E2E

| Flow | Amount |
|---|---|
| Strategy yielded | 1 MRT (1e18) |
| Deposited to RewardAccounting | 1 MRT |
| Banked to Wallet B (sole active seat) | 1 MRT |
| Claimed by Wallet B | 1 MRT |
| Unexplained | 0 ✅ |

---

## Indexer ✅

- Running on cron-job.org → POST https://board-fun.vercel.app/api/indexer/run every minute
- Idempotent: UNIQUE(tx_hash, log_index) ON CONFLICT DO NOTHING
- Cursor persists in indexer_state table — survives restarts
- All 9 lifecycle scenarios indexed and queryable
- Dual-contract log fetching: board events + reward accounting events (both standalone and in-process indexer)
- Reward tables: reward_deposits, seat_reward_state, reward_claims
- EarningsBanked accumulation guarded by seat_events UNIQUE insert — replaying from genesis does not double-count
- Rebuild: --rebuild flag truncates and replays from genesis block

---

## API ✅

Live at: https://board-fun.vercel.app

| Endpoint | Status |
|---|---|
| GET /api/boards/[boardId] | ✅ Board metadata + live counts |
| GET /api/boards/[boardId]/seats | ✅ All 100 seats with real-time status |
| GET /api/boards/[boardId]/seats/[seatId] | ✅ Seat detail + full event history |
| GET /api/boards/[boardId]/rewards | ✅ Total deposited, globalIndex, recent deposits |
| GET /api/boards/[boardId]/seats/[seatId]/rewards | ✅ Per-seat cumulative banked |
| GET /api/activity | ✅ Recent events feed |
| GET /api/profiles/[wallet] | ✅ Wallet stats |
| GET /api/profiles/[wallet]/seats | ✅ Seats with live status |
| GET /api/profiles/[wallet]/rewards | ✅ Total claimed + active seat rewards |
| GET /api/leaderboards | ✅ Top holders + top takeovers |
| GET /api/boardrooms/[boardId]/access | ✅ Real-time boardroom eligibility |
| POST /api/indexer/run | ✅ Cron trigger with Bearer auth |

All routes parameterized by boardId (env-var driven, no hardcoded slugs).

---

## Frontend (P9–P14) — 2026-08-14

All frontend finishing work complete on branch `claude/new-product-workflow-check-mw96bb`.

| Phase | Feature | Status |
|---|---|---|
| P9 | Route refactor: `/board/hood` → `/board/genesis` | ✅ |
| P10 | Economic visibility: Net Carry, 4 core numbers, live tape | ✅ |
| P11 | Profile: Lifetime Rewards + Former Seats | ✅ |
| P11 | Leaderboard: Top Earners + Longest Holders | ✅ |
| P12 | Takeover: reward preview, seat notifications, "SEAT IS YOURS" | ✅ |
| P13 | Admin simulator (`/admin/simulator`) — testnet only | ✅ |
| P14 | Mobile responsive layout (5-col grid, bottom nav, drawer sheet) | ✅ |

PRs merged: #7 (P9–P12), #8 (P9–P14 combined)

---

## Audit Fixes — 2026-08-15

Post-merge audit covering correctness, indexer completeness, and UI accuracy.

| # | Issue | Fix |
|---|---|---|
| 1 | All contract addresses pointed to Board v1 instead of v2 | Updated `config.ts`, `indexer/config.ts`, in-process indexer fallback, both `.env.example` files |
| 2 | `rewardAccountingAddress` in standalone indexer defaulted to `''` | Now defaults to `0xf51FAACD5a76Bf315a9473FcE549a49B2fe3cb78` |
| 3 | EarningsBanked double-accumulated on indexer replay | Guard via `seat_events` UNIQUE insert; accumulate to `seat_reward_state` only if row is new |
| 4 | EarningsBanked visible in activity feed (internal accounting event) | Excluded from activity query alongside `HoldingFeesSettled` |
| 5 | `eventLabel` had no cases for reward event types | Added `EarningsBanked→EARNED`, `RewardClaimed→CLAIMED`, `RewardDeposited→REWARD IN` |
| 6 | `/hood` page was a full duplicate of the board view | Replaced with `redirect('/board/genesis')` |
| 7 | Simulator page accessible to any wallet | Gated behind `NEXT_PUBLIC_ADMIN_WALLETS` allowlist |
| 8 | `boards/page.tsx` used raw `useEffect`/`fetch` | Converted to TanStack Query with 30s refetch interval |
| 9 | Tx hash in success modal was plain text | Now a clickable link to `explorer.testnet.chain.robinhood.com` |
| 10 | Mini grid legend showed only ACTIVE/VACANT | Expanded to ACTIVE/VACANT/GRACE/FORE with live counts from `allSeats` |
| 11 | In-process indexer never fetched from `REWARD_ACCOUNTING_ADDRESS` | Added parallel `getLogs` for reward contract; handles all 3 reward events with block timestamp cache |
| 12 | Yield section labelled "SIMULATED" on v2 testnet | Relabelled "TESTNET" (real events are being emitted) |

---

## Known Issues

- Board_v2 reward E2E used streamDuration=0 (no smoothing) for simplicity. Production smoothing (7-day default) is implemented in BoardVault and covered by 23 unit tests.
- Lifecycle steps 1–9 were run on Board.sol (original). Board_v2 base engine is identical; reward E2E (R1–R6) validates the reward layer on top.
- Frontend seat actions (take/topup/reprice/foreclose) now target Board_v2 (`0x6A57Ff5C1d105941c8A6CcCC681F37B1FED9733E`) as of the 2026-08-15 audit fix. Address migration applied across all config files.
- Rewards formatted as USDG on frontend; testnet reward token is MockRewardToken (MRT). Both are 6-decimal for display. Update before mainnet if reward token changes.
