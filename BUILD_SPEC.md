# BUILD_SPEC.md
## BOARD Engineering Specification

---

### Absolute Rule

**BACKEND AND CONTRACTS FIRST.**

Do not polish the frontend before the complete ownership economy works on testnet.

**Build order:**
```
1. CONTRACT STATE MACHINE
2. CONTRACT TESTS
3. TESTNET DEPLOYMENT
4. INDEXER
5. BACKEND API
6. MULTI-WALLET MANUAL TEST
7. END-TO-END AUTOMATED TESTS
8. FUNCTIONAL FRONTEND
9. REAL USER TESTING
10. DESIGN POLISH
```

Frontend polish is blocked until the backend proof milestone is complete.

---

### Recommended Stack

**Contracts**
- Solidity
- Foundry
- OpenZeppelin where appropriate
- Testing: unit, fuzz, invariant, integration

**Web**
- TypeScript
- Next.js
- viem
- wagmi
- Use versions already compatible with the repository.
- Do not upgrade dependencies without reason.

**Database**
- Postgres (Supabase acceptable)
- The database is NOT authoritative for economic state.
- The blockchain remains source of truth.

---

### Backend Responsibilities

Backend handles:
- Contract event indexing
- Seat state projections
- Activity feed
- Profile aggregation
- Leaderboard calculations
- Notification scheduling
- Share-card generation
- Boardroom authorization
- API responses
- Analytics

Backend must not independently invent financial state.

---

### Onchain Source of Truth

Contracts own:
- Seat ownership
- Seat price
- Prepaid holding balance
- Accrued holding fees
- Takeover settlement
- Protocol fees
- Grace eligibility
- Foreclosure eligibility
- Permanent Seat identity

---

### Contract Architecture

**Prefer minimal architecture.**

**Recommended: `Board.sol`**

Responsible for:
- Permanent Seat identities
- ERC-721-compatible ownership internally
- 100 Seat supply
- Vacant Seat acquisition
- Seat pricing
- Holding balances
- Holding-fee accrual
- Takeover
- Top-up
- Grace
- Foreclosure
- Protocol fee collection
- Ownership history events

A separate Seat token contract is NOT required if a single Board contract is cleaner. Do not create unnecessary contract layers.

---

### Internal Token Standard

Seats may use ERC-721-compatible ownership.

**This is an engineering detail. Do not leak product language.**

Good internal naming:
```
seatId
ownerOfSeat
takeSeat
setSeatPrice
```

Avoid:
```
mintNFT
NFTMarketplace
collectionFloor
```

---

### Transfer Restrictions

Normal unrestricted ERC-721 transfers **MUST NOT** bypass BOARD economics.

Users cannot transfer Seats privately using normal NFT transfer flows.

Ownership changes only through approved lifecycle actions:
```
VACANT → TAKE
OWNER A → TAKEOVER → OWNER B
OWNER → FORECLOSURE → VACANT
```

**This is mandatory.** Otherwise users could bypass: takeover fee, holding settlement, price mechanic, Seat provenance.

Implementation may:
- Disable standard transfers, or
- Override/guard transfers so only BOARD state transitions can move ownership

Document the decision.

---

### Settlement Asset

Use configurable ERC-20 settlement asset.

Requirements:
- Stable denomination preferred
- SafeERC20
- Configurable address
- Configurable decimals
- **Never assume 18 decimals**

Do not lock a mainnet token address prematurely.

---

### V1 Constants

```
Board:                     HOOD
Seat count:                100
Vacant Seat price:         $10
Holding rate:              0.5% per week
Grace:                     72 hours
Takeover:                  95% seller / 5% protocol
Min initial coverage:      2 weeks
```

Store configurable parameters where sensible, but do not over-engineer governance.

---

### Seat Data

Conceptual state:
```solidity
struct SeatState {
    uint256 price;
    uint256 prepaidBalance;
    uint256 lastSettledAt;
    uint256 graceStartedAt;
}
```

Ownership comes from the internal ownership/token state. Seat status can be derived where possible.

---

### Seat Status

Required logical states:
```
VACANT
ACTIVE
GRACE
FORECLOSABLE
```

Prefer deterministic derived state over unnecessary storage.

---

### Holding Cost Calculation

0.5% every seven days. Accrue continuously.

```
holding cost = Seat price × rate per second × elapsed time
```

- No floating point.
- Use fixed-point/integer arithmetic.
- Document rounding behavior.

---

### Lazy Settlement

Do NOT run a blockchain cron every second.

Fees accrue mathematically. Settle during interactions.

Settlement-sensitive actions:
- Set price
- Takeover
- Foreclosure
- Balance withdrawal (if added later)
- Other state-changing Seat actions

View methods calculate effective current state without requiring transactions.

---

### Coverage Calculation

System must expose:
```
current prepaid balance
effective balance after accrued cost
weekly cost
estimated depletion timestamp
grace start
grace end
```

Frontend/backend derives human-readable coverage from contract state.

---

### Vacant Seat Acquisition

User chooses Seat → selects initial Seat price → funds holding balance.

Required payment:
```
$10 vacant Seat price
+
minimum prepaid holding balance
```

Minimum prepaid balance must cover at least 2 weeks based on chosen Seat price.

Acquisition must atomically:
1. Verify Seat is VACANT
2. Collect $10
3. Collect prepaid holding balance
4. Assign Seat owner
5. Set Seat price
6. Set balance
7. Set settlement timestamp
8. Emit `SeatAcquired`

Product UI says: **Take Seat** — not "Mint."

---

### Set Price

```solidity
setSeatPrice(seatId, newPrice)
```

Process:
1. Verify caller owns Seat
2. Settle accrued holding cost using previous price
3. Ensure remaining balance/state is valid
4. Update price
5. Emit `SeatPriceChanged`

Price cannot be zero. Define a sensible minimum.

---

### Top-Up

```solidity
topUpSeat(seatId, amount)
```

Process:
- Settle/derive current state
- Transfer additional settlement asset
- Increase prepaid balance
- Restore ACTIVE status if currently in GRACE
- Emit `SeatToppedUp`

Top-up needs to be extremely reliable.

---

### Takeover

```solidity
takeSeat(
    seatId,
    expectedCurrentOwner,
    expectedPrice,
    newPrice,
    prepaidDeposit
)
```

Expected values protect against state changes.

Process:
1. Verify Seat occupied
2. Verify allowed state
3. Settle accrued holding cost
4. Verify current owner
5. Verify expected price
6. Collect takeover price
7. Calculate 95/5 split
8. Refund remaining prepaid balance to previous owner
9. Send seller payment
10. Send protocol fee
11. Transfer Seat ownership
12. Set buyer's new Seat price
13. Collect buyer prepaid balance
14. Enforce minimum 2 weeks coverage
15. Reset settlement timestamp
16. Clear grace state
17. Emit `SeatTaken`

Everything happens atomically.

---

### Takeover Settlement Example

```
Seat price:                 $100
Old prepaid balance (net):  $7

Buyer pays:                 $100 takeover
Old owner receives:         $95 takeover proceeds + $7 remaining holding balance
Protocol receives:          $5
Buyer additionally funds:   their own prepaid holding balance
```

Tests must reconcile all movements exactly.

---

### Grace

When effective prepaid balance reaches zero: Seat becomes **GRACE**.

No keeper transaction required to "activate" grace. Grace timestamp is deterministically calculable from:
- Price
- Rate
- Prepaid balance
- Last settlement timestamp

Grace ends exactly 72 hours after depletion.

---

### Grace Behavior

**During GRACE:**

Owner:
- Remains owner
- Keeps Boardroom access
- Can top up
- Can change price only if settlement/top-up requirements remain valid

Other users:
- Can still take the Seat (normal takeover process)

---

### Foreclosure

```solidity
forecloseSeat(seatId)
```

Anyone may call it after grace expires.

Process:
1. Confirm grace expired
2. Settle exhausted balance
3. Clear owner
4. Clear Seat price
5. Clear holding state
6. Move Seat to VACANT state
7. **Preserve Seat identity and history**
8. Emit `SeatForeclosed`

Do NOT destroy Seat identity. HOOD Seat #07 remains #07 permanently.

Product says: **"Seat #07 is available again."** — never "burn" or "remint."

---

### Contract Events

Minimum:
```
SeatAcquired
SeatPriceChanged
SeatTaken
SeatToppedUp
HoldingFeesSettled
SeatForeclosed
```

Optional:
```
SeatGraceStarted
```
(only if technically useful — if grace is derived, backend calculates it deterministically)

**`SeatAcquired` must include:**
```
seatId
owner
initialPrice
initialHoldingDeposit
timestamp/block
```

**`SeatTaken` must include:**
```
seatId
previousOwner
newOwner
takeoverPrice
newPrice
remainingBalanceRefund
protocolFee
timestamp/block
```

---

### Price Protection

Takeovers require:
```
expectedOwner
expectedPrice
```

Optional: `deadline`

If price/owner changes before execution: revert. Frontend refreshes.

---

### Security

Mandatory checks:
- No unauthorized ownership change
- No ordinary transfer bypass
- No self-takeover
- Reentrancy-safe
- SafeERC20
- Exact fee arithmetic
- No Seat duplication
- No Seat ID outside 1–100
- No unauthorized treasury withdrawal
- No zero-price Seat
- Stale takeover protection
- Proper time-boundary handling

---

### Contract Tests

**Seat Acquisition**
- Take vacant Seat
- Cannot take same vacant Seat twice
- Exact $10 fee
- Exact prepaid balance
- Correct owner
- Correct initial price
- Two-week minimum enforced

**Price Tests**
- Owner can reprice
- Non-owner cannot
- Old holding cost settles before new price
- Price cannot be zero
- Price change event correct

**Holding Tests**
- No elapsed time
- Seconds / one day / one week / many weeks
- Exact depletion
- Rounding
- Huge allowed values
- Price change mid-period
- Multiple top-ups

**Takeover Tests**
- Normal takeover
- Exact 95/5 split
- Remaining balance refund
- New owner assigned
- New price applied
- Minimum buyer prepaid coverage enforced
- Stale expected price fails
- Stale owner fails
- Self-takeover fails
- Takeover during grace
- Takeover near depletion boundary

**Grace Tests**
- Enters effective GRACE at depletion
- Top-up restores ACTIVE
- 72-hour calculation
- Foreclosure one second too early fails
- Foreclosure exactly at eligibility works
- Takeover during grace succeeds

**Foreclosure Tests**
- Correct state reset
- Seat identity preserved
- Previous owner removed
- Seat becomes available
- Same Seat can be acquired again
- History event emitted

**Fuzz Tests**
- Seat price
- Time elapsed
- Deposits
- Repricing sequences
- Takeover sequences
- Top-ups
- Grace transitions

---

### Invariants

**Exactly 100 Seat Identities** — never more, never fewer logically.

**One Seat, Maximum One Owner**

**No Ownership Bypass**

**Money Conservation** — every settlement token unit entering BOARD is attributable to: vacant Seat fees, prepaid holding balances, takeover payments, or protocol fees.

**No Negative Balance**

**Protocol Fee Exactly Defined**

**Seller Cannot Receive More Than Defined**

**Seat Identity Never Changes**

---

### Testnet Proof Milestone

No frontend polish until all scenarios work:

| # | Scenario |
|---|---|
| 1 | Wallet A takes vacant Seat #07 |
| 2 | Time passes. Holding fees accrue correctly. |
| 3 | Wallet A changes Seat #07 from $40 → $80. Old-rate fees settle. |
| 4 | Wallet B takes Seat #07 for $80. A receives 95% + remaining balance. Protocol gets 5%. B becomes owner. |
| 5 | B's holding balance depletes. Seat enters GRACE. |
| 6 | B tops up during grace. Seat returns ACTIVE. |
| 7 | Balance depletes again. 72 hours pass. Wallet C forecloses. Seat becomes VACANT. |
| 8 | Wallet D takes vacant Seat #07. Seat history still contains A → B → foreclosure → D. |

---

### Backend Database

**`boards`**
```
id, slug, name, market_symbol, chain_id, contract_address, seat_count, created_at
```

**`seats`** (projection)
```
board_id, seat_id, owner, price, effective_balance, status,
estimated_depletion_at, grace_ends_at, updated_at
```

**`seat_events`**
```
id, board_id, seat_id, event_type, tx_hash, block_number,
actor, previous_owner, new_owner, amount,
previous_price, new_price, metadata, occurred_at
```

**`profiles`**
```
wallet, created_at
```

**`notifications`**
```
wallet, board_id, seat_id, type, scheduled_for, sent_at, status
```

**`share_cards`**
```
event_id, asset_path, generated_at
```

---

### Indexer

Must:
- Index from deployment block
- Handle duplicate event delivery
- Be idempotent
- Persist cursor
- Restart safely
- Support full rebuild
- Support event replay
- Handle chain reorganizations appropriately
- Reconcile projections against chain state

Backend database must be rebuildable.

---

### APIs

Minimum:
```
GET /api/boards/hood
GET /api/boards/hood/seats
GET /api/boards/hood/seats/:seatId
GET /api/activity
GET /api/profiles/:wallet
GET /api/profiles/:wallet/seats
GET /api/leaderboards
GET /api/boardrooms/hood/access
```

Economic writes happen onchain.

---

### Notifications Engine

Use Seat coverage projection.

Thresholds: 14d / 7d / 3d / 24h / GRACE

Requirements:
- Idempotent notifications
- Top-up recalculates thresholds
- Stale notifications cancelled
- No duplicate spam

---

### Boardroom Access

Eligibility: owns at least one ACTIVE or GRACE Seat on that Board.

- Do not authorize permanently — re-check ownership.
- If user loses final Seat: access revoked.

---

### Share Card System

Takeover event triggers card creation.

Required data:
```
Board
Seat number
Old owner
New owner
Price
Owner count / history metric
Timestamp
```

Generate social-friendly image. **Required before public launch.**

---

### Functional Frontend

Only after backend proof.

**Pages:**
```
/              — basic explanation
/hood          — 100-Seat Board
/hood/7        — Seat detail
/activity      — live activity
/profile/:wallet
/leaderboard
/boardroom/hood — gated social space
```

**Functional UX Checklist** — tester must be able to:
1. Connect wallet
2. View all 100 Seats
3. Distinguish vacant and occupied Seats
4. Take a vacant Seat
5. Set Seat price
6. See weekly holding cost
7. See prepaid balance
8. See remaining coverage
9. Top up
10. Change price
11. Take someone else's Seat
12. See seller payout
13. See takeover in Activity
14. Generate/share takeover card
15. Enter Boardroom
16. Lose access after losing final Seat
17. Observe grace
18. Recover Seat through top-up
19. Observe foreclosure
20. Reacquire a foreclosed Seat

---

### Explicitly Out of Scope

Do NOT build:
- Protocol token / points / yield / staking
- Morpho / Uniswap / Stock Token trading
- AI agents / creator Boards / multiple Boards
- DAO / governance
- NFT marketplace / OpenSea / arbitrary Seat transfers
- Rarity / floor-price tracking
- Complex achievements
- Portfolio dashboard
- Mobile app

---

### Mainnet Gate

Mainnet requires:
- Complete test suite
- Fuzz/invariant coverage
- Testnet multi-wallet game
- Exact accounting reconciliation
- Security review
- Legal/product-language review
- Confirmed settlement asset
- Confirmed Robinhood Chain configuration
- Functional UI
- Tested notifications
- Tested share cards
- Tested Boardroom gating

---

### Definition of Backend-Proven

> Multiple unrelated wallets can complete the entire Seat lifecycle on testnet — take vacant Seat, accrue holding cost, reprice, top up, takeover, enter grace, recover, enter grace again, foreclose, and retake the same Seat — with exact financial reconciliation and indexed history matching onchain truth.

**Until this is demonstrated: DO NOT POLISH THE FRONTEND.**
