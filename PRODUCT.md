# PRODUCT.md
## BOARD

### Consumer Tagline

**Own your seat. Name your price. Anyone can take it.**

### Long-Term Vision

BOARD turns programmable markets into living communities of scarce, contestable, programmable Seats.

---

### What BOARD Is

BOARD creates a social ownership layer around real programmable markets. Each supported market can have a Board.

Examples:
- HOOD Board
- NVDA Board
- GME Board
- AAPL Board
- META Board

Each Board has a fixed number of scarce Seats.

**For the first experiment: HOOD Board — 100 Seats.**

A user can:
1. Take an available Seat
2. Choose the price of their Seat
3. Maintain it by paying a holding cost
4. Be taken over by anyone willing to pay their listed price
5. Take Seats from other users
6. Build permanent Seat history
7. Build profile reputation
8. Access the market's private Boardroom
9. Participate in the social game around that market

---

### Three-Layer Mental Model

```
REAL MARKET

HOOD
NVDA
GME
AAPL

     ↓

BOARD

100 scarce positions

     ↓

SEATS

#001
#002
#003
...
#100
```

Later (not V1):

```
SEAT
 ↓
PROGRAMMABLE ACCOUNT
 ↓
Assets · Rights · History · Credentials · Market state
```

That programmable-account layer is NOT part of V1.

---

### Important Product Language

Users own **SEATS**.

Do not describe BOARD as an NFT project. Do not expose NFT terminology in the consumer UI.

**Use:**
```
Seat · Take Seat · Own Seat · Seat Owner · Seat Price · Your Seats
Takeover · Board · Boardroom · Seat History · Holding Balance
Lost Your Seat · Back on the Board
```

**Do NOT use:**
```
NFT · Mint NFT · NFT Holder · Collection · Token ID · Floor Price
Rarity · NFT Marketplace · JPEG
```

ERC-721 is an internal implementation detail only. The user should never need to know or care.

---

### Core Mechanic

BOARD uses contestable/self-assessed ownership. Every owned Seat has a price chosen by its owner.

```
HOOD / SEAT #007

Owner:  Dan
Price:  $80
```

That means: Anyone can pay $80 and immediately take Seat #007. The owner cannot reject the purchase.

---

### Game Theory

The owner chooses their own Seat price. This creates the central tension:

| Price High | Price Low |
|---|---|
| Seat is harder to take | Seat is cheaper to maintain |
| Holding cost is higher | Someone can take it easily |

There is no objectively correct Seat price. Users continuously decide: **What is this Seat worth to me?** That is the core game.

---

### V1 Economics

These parameters are locked unless the founder explicitly changes them.

```
Board:                  HOOD
Seat count:             100
Vacant Seat price:      $10
Holding rate:           0.5% per week
Grace:                  72 hours
Seller share:           95%
Protocol takeover fee:  5%
Min new-owner coverage: 2 weeks
```

The settlement asset is USDG (a supported stable-denominated token). Do not expose token decimals or blockchain complexity in normal UI.

---

### Prepaid Holding Balance

Each owner maintains a holding balance.

```
Seat price:            $100
Weekly cost:           $0.50
Holding balance:       $10
Estimated coverage:    20 weeks
```

**The product must always clearly display:**
- Seat price
- Weekly holding cost
- Holding balance
- Coverage remaining
- Estimated depletion date

---

### Grace Period

When holding balance reaches zero:

```
ACTIVE → GRACE

Grace period: 72 hours
```

During Grace:
- Owner still owns Seat
- Boardroom access remains active
- Owner can top up
- Seat can still be taken normally

```
If top-up occurs:       GRACE → ACTIVE
If no top-up (72h):     GRACE → FORECLOSABLE
```

Anyone may trigger foreclosure. After foreclosure: **Seat → VACANT**

Notifications to owner at: 14 days, 7 days, 3 days, 24 hours, grace start.

---

### Seat Lifecycle

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
BALANCE DEPLETES
   ↓
GRACE
   ↓
TOP UP ─────────→ ACTIVE

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

---

### Seat States

**Financial states:**
```
VACANT
ACTIVE
GRACE
FORECLOSABLE
```

**Presentation states (not financial):**
```
YOUR SEAT
MOST CONTESTED
GENESIS SEAT
RECENTLY TAKEN
```

---

### Seat Identity

Every Seat is permanent. **HOOD Seat #007** remains Seat #007 regardless of owner changes, foreclosure, or reacquisition. What changes is ownership. The identity stays.

Seat numbers are always displayed as three digits with leading zeros: `#001`, `#007`, `#100`.

---

### Seat History

Seat history is an important part of the product. Track:

```
Current owner
Previous owners
Number of owners
Takeover count
Takeover prices
Price changes
Current holding duration
Longest holding duration
First acquisition date
Foreclosure history
Market events witnessed
```

Example:

```
HOOD / SEAT #007

CURRENT OWNER   0x81...93
PRICE           $84
HELD            19D
OWNERS          9
TAKEOVERS       13
LONGEST HOLD    43D
```

---

### Takeover Economics

Whenever somebody takes an occupied Seat:
- **95%** → previous owner
- **5%** → BOARD protocol

Any remaining prepaid holding balance is refunded separately after accrued costs are settled.

---

### Revenue Philosophy

BOARD currently has two native revenue sources:
- Holding costs
- Takeover fees

These are genuine protocol revenues.

**V1 must NOT automatically redistribute these to Seat holders.**

Holding cost has a specific game-theoretic purpose: forcing users to honestly price Seats. Do not distort that mechanism to manufacture yield.

The long-term goal is for Seats to eventually gain productive value from **external economic activity** — not from new Seat buyers recycling funds back to existing Seat holders.

---

### $BOARD Token

Do NOT launch `$BOARD` in V1.

A future token is not forbidden, but it must answer: *Why does the BOARD network actually need this token?*

**Do not add a token because NFT projects currently have associated tokens.**

---

### ERC-6551 Direction

ERC-6551 is a strong future fit. Eventually every Seat may have its own programmable onchain account.

**Important engineering rule:** Architect for it. Do not ship it yet.

We have not yet answered: *What should Seat #007 actually do with its account?* Do not build infrastructure before we know its purpose. Current Seat contracts should simply avoid making future ERC-6551 integration impossible.

---

### V1.5 — Robinhood Market Layer

After the functional game works, integrate official Robinhood data. The terminal should show:

```
HOOD / ROBINHOOD MARKETS

MARKET
────────────────────────
PRICE             $—
STATE             OPEN
STOCK TOKEN       0x...
CORPORATE ACTION  NONE

BOARD
────────────────────────
SEATS             100
OWNED              82
OPEN               18
TAKES / 24H        31
```

---

### Market Events

Eventually real market events become part of Board history:
- Earnings
- Stock splits
- Corporate actions
- Market milestones
- Robinhood Chain milestones

These affect Board state, Seat history, Seat art, and community events.

---

### Seat Art Direction

Individual Seats should eventually reveal beautiful generative/onchain art.

**Do not use cartoon broker/PFP aesthetics.** Projects on Robinhood Chain already own that visual category. BOARD should be more abstract, financial, and historical.

Seat art should derive from:
```
Seat number
Board
Age
Number of owners
Takeovers
Holding history
Market events witnessed
Other permanent Seat state
```

**History is rarity.**

Do NOT add arbitrary rarity scores (`Legendary / Epic / Rare / Common`) unless those statuses naturally emerge from real history. A Seat becomes interesting because of what happened to it.

---

### Profiles

Every wallet receives a BOARD profile.

```
DAN

CURRENT SEATS        1
TOTAL OWNED         19
TAKEOVERS           27
TIMES TAKEN         11
LONGEST HOLD        62D

CURRENT SEATS:
  HOOD #007
```

Future multi-board profile:

```
HOOD #007
NVDA #021
GME #003
```

---

### Boardroom

Every market Board has a private Boardroom. **Only current Seat owners may access it.**

Access is active if the user owns at least one ACTIVE or GRACE Seat on that Board.
Access ends when they lose their final Seat. Access returns when they acquire another.

```
HOOD BOARDROOM — 100 maximum members
```

The Boardroom should combine:

**MARKET**
- Market feed
- Corporate events
- Stock Token state

**COMMUNITY**
- Discussion
- Research
- Polls
- Threads

**BOARD**
- Takeovers
- Open Seats
- Most contested
- Recently repriced

Do not turn this into a DAO. BOARDROOM ≠ DAO. It is a scarce market community.

---

### Activity Feed

BOARD must feel alive. The activity feed should feel like a **trading tape**, not a social newsfeed.

```
17:41:08    #007 TAKEN       $84
17:40:51    #031 REPRICED    $52 → $68
17:38:09    #082 ACQUIRED    $10
17:37:11    #011 TOPPED UP   $5
```

Dense rows. Timestamps prominent. No floating cards.

---

### Share Cards

Share cards are V1 product, not marketing polish. Every takeover generates a shareable card.

```
HOOD BOARD

SEAT #007
CHANGED HANDS

DAN → ALEX

$81

9TH OWNER

TAKE YOUR SEAT
```

Optimized for X and other social platforms. Purpose: turn every takeover into distribution.

---

### Leaderboards

Initial categories:
- Most Takeovers
- Longest Hold
- Most Contested Seats
- Highest Seat Prices
- Most Active Owners
- Most Owners per Seat

**Do NOT create:**
- Profit leaderboards
- Investment-return leaderboards
- Speculative rankings

---

### North-Star Metric

**Primary:** Takeovers per active Seat per week

**Supporting funnel:**
```
VISIT
 ↓
TAKE SEAT
 ↓
SET PRICE
 ↓
RETURN
 ↓
DEFEND / LOSE
 ↓
TAKE AGAIN
```

**Strongest signal:** A user loses their Seat and voluntarily comes back to acquire another one.

---

### Design Direction (Locked)

**FINANCIAL TERMINAL × COMPETITIVE GAME BOARD**

Do NOT redesign into:
- NFT marketplace
- Gradient-heavy crypto website
- Glassmorphism
- Memecoin casino
- Generic SaaS
- PFP platform

The product should feel like:
```
Bloomberg / trading terminal density
+
Geist / Vercel structural discipline
+
BOARD competitive game identity
```

**Visual rules:**
- Dark mode default
- Near-black background
- White/neutral text
- Thin borders
- Hard grid structure
- Minimal shadows
- Restrained border radius
- High information density
- Strong whitespace hierarchy

**Typography:**
```
Geist Sans  → general interface
Geist Mono  → Seat IDs, prices, wallet addresses, timestamps, market data
```

**Accent color:**
The lime/green accent (`#ccff00`) signals:
- Primary action
- Selected Seat
- Your Seat
- Live state
- Important status

Neutral white/gray should dominate. Do not make BOARD look like a neon casino.

---

### Landing Page

Hero copy is locked:

> **Own your seat.**
> **Name your price.**
> **Anyone can take it.**

Supporting:
> 100 seats around the HOOD market. Take one, set your price and defend your position. Every seat is always for sale.

CTA: **ENTER HOOD BOARD**

The landing page should preview the live Board. Do not explain Grace/foreclosure in the hero.

---

### Stock Token Relationship

V1 does NOT:
- Require ownership of HOOD Stock Tokens
- Custody HOOD
- Distribute HOOD yield
- Promise dividends
- Represent ownership in Robinhood Markets

BOARD creates a social ownership layer around the market.

---

### Product Phases

| Phase | Name | Goal |
|---|---|---|
| 0 | Backend Proof | Prove the ownership state machine on testnet |
| 1 | Functional HOOD Board | 100 Seats, terminal UI, full lifecycle |
| 1.5 | Robinhood Market Layer | Real HOOD price/state, market events |
| 1.75 | Seat Art | Generative financial Seat art from history |
| 2 | Programmable Seat Research | ERC-6551 exploration — answer "what should it do?" |
| 3 | External Board Revenue | Identify ONE real external revenue source |
| 4 | Productive Seats | Only after genuine external revenue exists |
| 5 | More Official Boards | NVDA, GME, AAPL, META — only if HOOD works |
| 6 | Creator Boards | Communities launch Boards around approved markets |
| 7 | Token / Agents / Advanced | Only after actual network demand exists |

---

### V1 Forbidden Scope

Do NOT add without explicit instruction:
```
$BOARD token · points · yield · staking · Morpho · Uniswap
Stock Token custody · Stock Token trading · AI agents · creator Boards
Multiple Boards · referrals · DAO · governance · rarity · NFT marketplace
OpenSea integration · arbitrary ERC-721 transfers · complex achievements
Mobile app · portfolio products · ERC-6551 (yet)
```

---

### Success Definition

**V1 is working if:**
- Most Seats become occupied
- Owners actively adjust prices
- Takeovers happen regularly
- Users talk about Seat numbers
- Certain Seats become culturally desirable
- Users return after being taken over
- Share cards circulate
- Boardroom conversations happen
- Users monitor the Board even when not transacting

**V1 failed if:**
- Users take one Seat and disappear
- Almost nobody reprices
- Almost no takeovers happen
- Users view holding costs only as an annoyance
- Seat numbers/history have no social meaning

---

### Product Principles

1. **Seat, Never NFT** — Seat is the user-facing object.
2. **Game First** — Prove behavior before layering revenue.
3. **Behavior Before Revenue** — The first Board is an experiment.
4. **Scarcity Must Stay Real** — HOOD always has 100 Seats. Do not increase supply.
5. **History Creates Value** — Seat provenance accumulates permanently.
6. **No Token Before Network Demand** — No `$BOARD` in V1.
7. **Markets Create Communities** — The Board is a social layer, not a marketplace.
8. **Do Not Force Yield** — Holding cost is a mechanism, not a fee to redistribute.
9. **Blockchain Should Disappear** — Users interact with Seats, Prices, Balance, Boardroom, Takeovers — not blockchain mechanics.
10. **Competition Over Passive Holding** — Seat ownership must create ongoing decisions.
11. **Build Less** — Anything not needed to prove the core loop goes into backlog.
12. **Do Not Copy Current NFT Metas** — Research what's technically possible; preserve BOARD's unique primitive.

---

### Founder Instruction

Do not modify the core product because a current NFT project is trending.

Use research to understand:
- What is technically possible
- What users already understand
- What economic models work

But preserve BOARD's unique primitive:

**SCARCE, CONTESTABLE POSITIONS AROUND PROGRAMMABLE MARKETS.**
