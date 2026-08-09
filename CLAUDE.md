# CLAUDE.md
## BOARD AI Engineering Instructions

Before doing any work, read completely:
1. `PRODUCT.md`
2. `BUILD_SPEC.md`
3. `CLAUDE.md`

These files are product source of truth.
Do not silently change product behavior.
If implementation and documentation conflict: **STOP and report the discrepancy.**

---

### Product

BOARD is a social ownership game built around scarce, contestable Seats.

First experiment: **HOOD Board — 100 Seats.**

Every Seat:
- Has a permanent number
- Can be taken while vacant
- Has a self-assessed price
- Is always available for takeover while occupied
- Incurs holding costs
- Uses a prepaid holding balance
- Enters grace when balance is exhausted
- Can be foreclosed after grace
- Accumulates permanent ownership history

---

### Critical Language Rule

**USERS OWN SEATS.**

Do not expose NFT language in normal UI.

**User-facing terms:**
```
Seat · Take Seat · Own Seat · Seat Owner · Seat Price · Your Seats · Takeover · Board · Boardroom
```

**Do not use:**
```
NFT · NFT Owner · Mint NFT · NFT Collection · NFT Marketplace · Token ID · Floor Price · Rarity
```

ERC-721 is an internal implementation detail only.

---

### V1 Economics

Source of truth:
```
Board:                      HOOD
Seat count:                 100
Vacant Seat price:          $10
Holding rate:               0.5% per week
Grace:                      72 hours
Seller share:               95%
Protocol takeover fee:      5%
Min new-owner coverage:     2 weeks
```

Do not replace these with ranges.

---

### Development Phase

Unless human operator explicitly changes it: **PHASE 1 — BACKEND PROOF**

Goal: Prove the economic state machine. NOT: build a beautiful frontend.

**Build Priority:**
```
P0  Contracts
P1  Contract Tests
P2  Testnet Deployment
P3  Indexer
P4  Backend API
P5  End-to-End Lifecycle Proof
P6  Functional Frontend
P7  User Testing
P8  Design Polish
```

Do not work on P8 while P0–P5 are incomplete.

---

### Core State Machine

```
VACANT
  ↓
TAKE SEAT
  ↓
ACTIVE
  ↓
REPRICE / TOP UP
  ↓
TAKEOVER
  ↓
NEW OWNER
  ↓
BALANCE DEPLETION
  ↓
GRACE
  ↓
TOP UP ──────────→ ACTIVE

OR

GRACE
  ↓
72 HOURS
  ↓
FORECLOSABLE
  ↓
FORECLOSE
  ↓
VACANT
```

Every transition requires tests.

---

### Build Only What V1 Needs

Before implementing anything ask: **Does this directly help prove the Seat ownership loop?**

If no: do not build it. Put it in backlog if useful.

---

### V1 Forbidden Scope

Do not add without explicit instruction:
```
$BOARD token · points · yield · staking · Morpho · Uniswap · Stock Token custody
Stock Token trading · AI agents · creator Boards · multiple Boards · referrals
DAO · governance · rarity · NFT marketplace · OpenSea integration
arbitrary ERC-721 transfers · complex achievements · portfolio products
```

---

### Internal Ownership Implementation

ERC-721 compatibility is acceptable for Seat ownership. But product terminology remains Seat-based.

**Prefer internal APIs such as:**
```
takeVacantSeat · takeSeat · setSeatPrice · topUpSeat · forecloseSeat · ownerOfSeat
```

**Avoid product-level APIs such as:**
```
mintNFT · buyNFT · NFTMarketplace
```

---

### Transfer Rule

Users **MUST NOT** be able to bypass BOARD by calling ordinary NFT transfer functions.

Seat ownership can change only through BOARD's lifecycle.

If an external transfer path exists: **the implementation is incorrect.**

---

### Blockchain Source of Truth

**Onchain owns:**
- Seat ownership · price · holding balance · accrued holding cost
- Takeover · fee settlement · grace/foreclosure eligibility

**Database owns only:**
- Projections · feeds · notifications · profiles · social metadata · analytics

---

### Contract Philosophy

Choose: **simple · deterministic · auditable · boring · well-tested**

Over: clever · over-abstracted · prematurely optimized · unnecessarily upgradeable

Funds will eventually be involved. **Correctness wins.**

---

### Testing Rule

Every economic feature ships with tests. Compilation does not mean complete.

Use: unit tests · fuzz tests · invariant tests · integration tests

**Time Testing — explicitly test:**
```
0 seconds
1 second
1 day
7 days
multiple weeks
exact depletion
1 second before depletion
exact grace start
1 second before grace expiry
exact grace expiry
after grace expiry
```

Time bugs are critical.

---

### Accounting Rule

Every takeover test must reconcile:
```
buyer wallet
seller wallet
BOARD contract
treasury
remaining prepaid balance
```

There must be zero unexplained funds.

---

### Security Requirements

Mandatory:
- No arbitrary Seat transfer
- No double ownership
- No self-takeover
- No reentrancy exploit
- No stale-price takeover
- No unauthorized Seat mutation
- No accidental admin confiscation
- No Seat ID > 100
- Safe ERC-20 behavior
- Exact fee calculation
- Safe timestamp handling

---

### Backend Proof Requirement

Before declaring Phase 1 complete, create: **`BACKEND_PROOF.md`**

Must include:

**Network:**
```
Network · Chain ID · RPC/provider · Deployment block · Settlement asset
```

**Contracts:** addresses

**Tests:** unit / fuzz / invariant / integration counts and passing status

**Real Testnet Lifecycle** — transaction hashes for:
1. Take vacant Seat
2. Reprice
3. Top-up
4. Takeover
5. Grace
6. Grace recovery
7. Second depletion
8. Foreclosure
9. Same Seat taken again

**Accounting:** before/after balances

**Indexer:** prove restart, replay, duplicate handling, rebuild

**API:** prove API state matches contract state

**Known Issues:** list openly. Do not declare backend proven with unresolved critical issues.

---

### STATUS.md

Maintain throughout development.

```
# Current Phase
# Completed
# In Progress
# Blockers
# Tests
# Next
```

Update after meaningful milestones.

---

### DECISIONS.md

Record product/architecture changes.

```
## YYYY-MM-DD — Decision

Decision:
Reason:
Alternatives:
Impact:
```

Do not silently mutate economics.

---

### Functional Frontend Rule

Once backend is proven: build an intentionally plain functional frontend.

Goal: prove users can operate the system. Do not start visual perfection yet.

**Functional Frontend Must Support:**
```
Connect wallet · View HOOD Board · View all 100 Seats · Take vacant Seat
Set price · View holding cost · View remaining coverage · Top up · Reprice
Take another owner's Seat · View history · View activity · View profile
View leaderboard · Generate share card · Enter Boardroom
Lose Boardroom access when no longer eligible
```

---

### Design Phase Gate

Only move to design-polish phase after:
- Backend proof complete
- Functional frontend works
- At least 5 users have played the game end to end

Then create/finalize: **`DESIGN.md`**

**Design direction:** Financial terminal × boardroom × competitive game. Geist-style structural foundation. Seat grid is the primary interface.

**Do not make it look like:**
- NFT marketplace
- Web3 neon casino
- Generic SaaS dashboard
- Memecoin launchpad

---

### Product Success

BOARD does not succeed because:
```
TVL is high · 100 Seats sell out · X followers increase · people like the visuals
```

BOARD succeeds when: **USERS TAKE SEATS FROM EACH OTHER REPEATEDLY.**

The strongest signal: **A user loses a Seat and comes back to take another.**

Optimize for that behavior.

---

### Definition of Backend Proven

Backend is proven when: Multiple unrelated wallets can complete the full Seat lifecycle on testnet with exact financial reconciliation, permanent Seat history, correct indexed state and no ownership bypass.

**Until then: DO NOT POLISH THE FRONTEND.**
