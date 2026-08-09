# NOTES.md

## Project: BOARD

### What it is

BOARD is a social ownership game for programmable markets. Users take, price, defend, and lose Seats — scarce positions within a Board built around a market. The first Board is HOOD (100 Seats). The core tension: price high and it costs more to hold; price low and anyone can take it.

Users interact with Seats, Prices, Holding Balances, Takeovers, and the Boardroom. NFT/ERC-721 is implementation detail — never surfaces in product language.

---

### Current Status

**Phase 1 — Day 0. Nothing built yet.**

Repo is empty. PRODUCT.md written and committed. Next step: spec the architecture and decide the tech stack.

---

### Key Decisions Made

| # | Decision | Rationale |
|---|---|---|
| 1 | HOOD Board only for V1, 100 Seats | Prove the loop before expanding |
| 2 | Initial Seat price: $10 | Low enough to get seats occupied fast |
| 3 | Holding rate: 0.5%/week of self-assessed price | Creates tension without being punishing |
| 4 | Minimum 2 weeks prepaid on acquisition | Prevents instant-grace abuse |
| 5 | Grace period: 72 hours after balance exhausted | Enough time to top up, not enough to ignore |
| 6 | Takeover split: 95% to seller, 5% to BOARD | Seller gets almost everything; protocol earns on activity |
| 7 | Settlement in stable token | No price exposure on top of Seat mechanic |
| 8 | No $BOARD, no yield, no staking in V1 | Behavior before revenue |
| 9 | ERC-721 internally, never exposed to user | Seat identity and composability without NFT framing |
| 10 | Share cards on every takeover | Distribution mechanic baked into the core loop |

---

### What's Been Built

_Nothing yet._

---

### North-Star Metric

**Takeovers per active Seat per week**

Strongest signal: user loses a Seat and voluntarily comes back to take another one.

---

### V1 Scope (what to build)

- [ ] Smart contracts: Board, Seat (ERC-721), holding balance, grace/foreclosure logic
- [ ] Indexer / subgraph for Seat state and history
- [ ] Frontend: Board view (100 Seats), Seat detail, Take flow, Reprice flow, Top-up flow
- [ ] Activity feed (real-time)
- [ ] Seat history per Seat
- [ ] Wallet profiles
- [ ] Boardroom (gated by Seat ownership)
- [ ] Leaderboards
- [ ] Share cards (auto-generated on takeover)
- [ ] Notifications (14d / 7d / 3d / 24h / grace)

---

### Explicitly Out of V1 Scope

$BOARD · yield · staking · HOOD trading · Morpho · Uniswap · AI agents · creator Boards · multiple Boards · DAO · governance · points · referrals · rarity · NFT marketplace · mobile app

---

### Tech Stack

_Not decided yet. Next session should spec this out._

---

### Open Questions

- Chain? (Robinhood Chain, Base, or other)
- Stable token for settlement? (USDC assumed)
- Frontend framework?
- Real-time infrastructure for activity feed and notifications?
- Boardroom implementation (chat layer)?

---

### Working Agreement

- Read NOTES.md at the start of every session.
- Update NOTES.md when key decisions are made, things are built, or status changes.
- Commit NOTES.md alongside the work, not separately.
- Branch: `claude/new-product-workflow-check-mw96bb`
- PRs only when explicitly requested.
- Follow DESIGN.md for all UI work (to be created).
- No hardcoded hex values — CSS custom property tokens only.
