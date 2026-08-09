# PRODUCT.md
## BOARD

### Product Summary

BOARD is a social ownership game for programmable markets.
Each supported market has a limited Board containing scarce Seats.

For the first experiment:
**HOOD Board — 100 Seats**

A user can:
1. Take an available Seat.
2. Set their own price for that Seat.
3. Pay an ongoing holding cost based on that price.
4. Be automatically bought out by anyone willing to pay the listed price.
5. Take Seats from other users.
6. Build ownership history and reputation.
7. Access a Seat-holder-only Boardroom.

**The central mechanic:**
Price your Seat too high and it becomes expensive to maintain.
Price it too low and somebody can take it.
Every Seat is always for sale.

---

### Important Product Language

Users interact with **Seats**.

They do NOT interact with:
- NFTs
- token IDs
- NFT collections
- NFT marketplaces
- minting terminology
- ERC-721 terminology

These are implementation details.

**User-facing language:**
- Take a Seat
- Own a Seat
- Your Seats
- Seat #07
- Set your price
- Take this Seat
- Lost your Seat
- Seat history
- Board history

Technical documentation may explain that Seats use ERC-721-compatible ownership internally. The consumer product should not describe BOARD as an NFT project.

---

### Vision

Traditional markets create communities. Programmable markets can create something new: scarce, contestable social ownership around those communities.

BOARD introduces:

```
MARKET
  ↓
BOARD
  ↓
SEATS
  ↓
OWNERS
```

The long-term vision: Every important programmable market can have a living social ownership layer. Stocks are the first context. Later, Boards could exist around other markets, protocols, assets, communities and financial ecosystems.

---

### Product Thesis

Tokenized financial assets should enable new behaviors rather than simply recreating brokerage interfaces onchain.

BOARD introduces:

**Contestable Ownership**
- A Seat is scarce.
- A Seat has history.
- A Seat has an owner.
- The owner chooses its price.
- Anyone can pay that price and take the Seat.
- Ownership is never permanent.

---

### V1 Experiment

Launch only: **HOOD Board — 100 Seats**

Do NOT launch other Boards initially.

The purpose is to answer: Will people care enough about owning a Seat to defend it, price it, lose it, take another one and return?

---

### Exact V1 Economics

**Initial Seat Price: $10**

All 100 Seats begin with the same initial acquisition price. A user taking a vacant Seat pays:
```
$10 initial Seat price
+
required prepaid holding balance
```

The settlement asset should be a supported stable-denominated token. Do not expose token decimals or blockchain complexity in normal UI.

---

### Seat Price

Every owner must assign a self-assessed price to their Seat.

```
HOOD
SEAT #07

Your price:
$80
```

That means: Anyone can take Seat #07 by paying $80. The owner cannot reject the purchase.

---

### Takeover Economics

Whenever somebody takes an occupied Seat:
- **95%** → previous owner
- **5%** → BOARD

```
Seat price:     $100

Seller:          $95
BOARD fee:        $5
```

Any remaining prepaid holding balance belonging to the previous owner is refunded separately after accrued holding costs are settled.

---

### Holding Cost

**Holding rate: 0.5% per week**

The holding cost is based on the Seat's self-assessed price.

```
Seat price:      $100
Weekly cost:     $0.50
```

The cost should accrue continuously.

**This creates the core tension:**

| Price High | Price Low |
|---|---|
| Harder for another user to take | Cheaper to hold |
| More expensive to hold | Easier for another user to take |

There is no perfect price.

---

### Prepaid Holding Balance

Owners deposit funds used to cover holding costs.

```
Seat price:            $100
Holding rate:          $0.50/week
Prepaid balance:       $10
Estimated coverage:    20 weeks
```

**The product must always clearly display:**
- Seat price
- Weekly holding cost
- Prepaid balance
- Estimated remaining coverage
- Estimated depletion date
- Grace-period status

---

### Minimum Initial Coverage

When taking a vacant or occupied Seat, the new owner must fund at least **2 weeks of holding coverage** based on the new price they choose. This prevents users from acquiring Seats that instantly enter grace.

---

### Grace Period

When a Seat's prepaid balance becomes exhausted:

```
Seat enters: GRACE
Grace period: 72 hours
```

**During grace:**
- The owner still owns the Seat
- The Seat remains available for takeover
- The owner can top up
- Boardroom access remains active
- The UI clearly warns the owner

```
If top-up occurs:       GRACE → ACTIVE
If no top-up (72h):     GRACE → FORECLOSABLE
```

Anyone may trigger foreclosure. After foreclosure: **Seat → VACANT**

---

### Notifications

Owners receive warnings at approximately:
- 14 days coverage remaining
- 7 days
- 3 days
- 24 hours
- Grace started

Top-up should require as few interactions as possible.

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

Every Seat has a permanent identity. **HOOD Seat #07** remains Seat #07 regardless of owner changes, foreclosure, or reacquisition. The Seat accumulates history.

---

### Technical Ownership

Internally, Seats use unique onchain tokenized ownership. ERC-721 is the initial recommended implementation.

**Do NOT show:**
- NFT terminology
- OpenSea links
- Floor price / rarity / collection statistics
- Mint terminology

BOARD is not positioned as an NFT collection.

---

### Seat History

Every Seat develops provenance. Track:
- First owner
- Current owner
- Previous owners
- Acquisition timestamps
- Takeover prices
- Price changes
- Longest ownership duration
- Number of takeovers
- Foreclosure history
- Time held by current owner

```
HOOD / SEAT #07

CURRENT OWNER   0x81...93
PRICE           $82
HELD            18 days
OWNERS          9
TAKEOVERS       11
LONGEST HOLD    43 days
```

---

### Profiles

Every wallet receives a BOARD profile.

```
DAN

CURRENT SEATS        4
TOTAL SEATS OWNED   19
TAKEOVERS MADE      27
TIMES TAKEN OVER    11
LONGEST HOLD        62d

CURRENT SEATS:
  HOOD #07
```

---

### Boardroom

Every Board has a private social space. Only current Seat owners may enter.

```
HOOD BOARDROOM
100 maximum members
```

Initial functionality:
- Simple discussion
- Market/event feed
- Polls
- Announcements
- Seat activity

If a user loses their final Seat on that Board: access removed. If they take another Seat: access returns.

---

### Activity Feed

BOARD must feel alive. Every important action appears publicly.

```
HOOD #07 TAKEN
0x81...93 → 0x42...17
$81 · 8 seconds ago

HOOD #21 REPRICED
$54 → $73 · 34 seconds ago

HOOD #44 TAKEN (First owner)
$10 · 2 minutes ago

HOOD #39 ENTERED GRACE
8 minutes ago
```

---

### Share Cards

Share cards are part of V1. Every takeover generates a social card.

```
HOOD BOARD

SEAT #07
JUST CHANGED HANDS

DAN → ALEX

$81

9TH OWNER

TAKE YOUR SEAT
```

Optimized for X and other social platforms. Purpose: turn every takeover into distribution.

---

### Leaderboards

- Most Takeovers
- Longest Hold
- Most Contested (Seats)
- Highest Priced Seats
- Most Active Owners

**Do NOT create:**
- Profit leaderboards
- Investment-return leaderboards
- Speculative floor-price rankings

---

### Stock Token Relationship

V1 does NOT:
- Require ownership of HOOD Stock Tokens
- Custody HOOD
- Distribute HOOD
- Generate HOOD yield
- Promise dividends
- Represent ownership in Robinhood Markets
- Automatically trade Stock Tokens

BOARD creates a social ownership layer around the market.

---

### Core Loop

```
DISCOVER BOARD
      ↓
SEE 100 SEATS
      ↓
TAKE A VACANT SEAT
OR TAKE SOMEONE ELSE'S
      ↓
SET YOUR PRICE
      ↓
FUND YOUR HOLDING BALANCE
      ↓
BECOME A BOARD MEMBER
      ↓
SOMEONE TAKES YOUR SEAT
      ↓
REACT / SHARE / RETURN
      ↓
TAKE ANOTHER SEAT
      ↓
REPEAT
```

---

### North-Star Metric

**Primary:** Takeovers per active Seat per week

**Supporting:**
- % of Seats occupied
- Weekly active Seat owners
- Repeat Seat ownership
- % of users returning after losing a Seat
- Repricing frequency
- Average holding duration
- Boardroom participation
- Share-card usage
- Seat turnover
- Number of unique owners

**Strongest behavioral signal:** Someone loses their Seat and voluntarily comes back to acquire another one.

---

### What Success Looks Like

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
2. **Behavior Before Revenue** — The first Board is an experiment.
3. **Scarcity Must Stay Real** — HOOD always has 100 Seats. Do not add more.
4. **No Token Before Product Behavior** — No `$BOARD` in V1.
5. **Social Before Financial Complexity** — Do not add yield before proving people care.
6. **History Creates Culture** — Seat provenance accumulates permanently.
7. **Blockchain Should Disappear** — Users interact with Seats, Prices, Balance, Boardroom, Takeovers — not blockchain mechanics.
8. **Competition > Passive Holding** — Seat ownership must create decisions.
9. **Build Less** — Anything not needed to prove the core loop goes into backlog.

---

### Explicitly Out of Scope for V1

Do NOT build:
- `$BOARD`
- Yield / staking
- HOOD trading
- Morpho / Uniswap integration
- AI agents
- Creator Boards
- Multiple Boards
- DAO / governance
- Points / referral farming
- Rarity system
- NFT marketplace / external NFT trading
- Complex achievements
- Mobile app

---

### Phases

| Phase | Name | Description |
|---|---|---|
| 1 | Prove Ownership Game | HOOD, 100 Seats, core mechanics |
| 2 | Social Depth | Richer Boardroom, achievements, notifications, better profiles |
| 3 | More Official Boards | NVDA, AAPL, META, TSLA (only after demand) |
| 4 | Creator Boards | Communities/creators launch Boards around approved markets |
| 5 | Agent Participation | Agents participate under user-defined budgets |
| 6 | Deeper Programmable-Market Integration | Market-specific integrations based on user behavior |

---

### Positioning

**Primary Tagline:** Own your seat. Name your price. Anyone can take it.

**Alternative:** Take your seat in the market.

**Description:** BOARD creates scarce, contestable Seats around programmable markets. Take a Seat, choose what it's worth, maintain it, join the Boardroom and defend your position—because anyone can take your Seat at the price you set.

---

### Brand Vocabulary

**Use:**
Board · Seat · Take a Seat · Owner · Price · Takeover · Boardroom · Seat History · Holding Balance · Hold Your Seat · Lost Your Seat · Back on the Board

**Avoid:**
NFT · mint · NFT holder · collection · floor · rarity · NFT marketplace · token ID · JPEG
