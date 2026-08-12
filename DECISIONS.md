# DECISIONS.md

Record of product and architecture decisions. Update when anything changes.
Do not silently mutate economics or product behavior.

Format:
```
## YYYY-MM-DD — Title

Decision:
Reason:
Alternatives:
Impact:
```

---

## 2026-08-09 — Chain: Robinhood Chain

Decision: Build on Robinhood Chain.

Reason: Natural fit for HOOD as the first Board — same ecosystem, audience alignment.

Alternatives: Base, Ethereum mainnet.

Impact: All contracts deploy to Robinhood Chain. Testnet deployment targets Robinhood Chain testnet. Settlement asset must be a stable token supported on Robinhood Chain.

---

## 2026-08-09 — Single Board.sol contract

Decision: Implement everything in a single `Board.sol` rather than separate contracts for Board registry and Seat token.

Reason: Simpler architecture, fewer attack surfaces, easier to audit. A separate Seat token contract is only warranted if composability requirements emerge — none exist in V1.

Alternatives: Separate `SeatToken.sol` (ERC-721) + `Board.sol` (economics).

Impact: All Seat ownership, pricing, holding, takeover, grace, and foreclosure logic lives in one contract. Standard ERC-721 transfers are disabled/guarded within that contract.

---

## 2026-08-09 — Lazy settlement (no cron)

Decision: Holding fees accrue mathematically. No keeper or cron required to charge fees. Fees settle during state-changing interactions (reprice, takeover, top-up, foreclosure).

Reason: Simpler, cheaper, no keeper dependency. Grace and foreclosure eligibility are deterministically derivable from chain state.

Alternatives: Keeper network, Chainlink Automation, scheduled settlement transactions.

Impact: View functions must calculate effective current state. Backend must derive grace/depletion timestamps from contract parameters rather than waiting for an event.

---

## 2026-08-09 — Transfer restrictions: disable standard ERC-721 transfers

Decision: Block `transferFrom` and `safeTransferFrom` on Seat tokens so ownership can only change through BOARD lifecycle actions (takeVacantSeat, takeSeat, forecloseSeat).

Reason: Unrestricted transfers would bypass takeover fees, holding settlement, price mechanic, and Seat provenance. The ownership game only works if all transfers go through the protocol.

Alternatives: Allow transfers but charge fees on them (complex, gameable).

Impact: Seats are not tradeable on NFT marketplaces. This is intentional and aligns with product positioning (BOARD is not an NFT project).

---

## 2026-08-09 — Configurable settlement asset, no hardcoded address

Decision: Settlement asset is a constructor/config parameter, not hardcoded.

Reason: Robinhood Chain stable token address not yet confirmed. Avoids redeployment if it changes during development.

Alternatives: Hardcode USDC address.

Impact: Deployment scripts require settlement asset address as input. Tests use a mock ERC-20.

---

## 2026-08-09 — Master Product Brief: PRODUCT.md updated

Decision: Expanded PRODUCT.md to match the Master Product Brief. No economics changed.

Reason: The brief adds missing sections that were not in the original PRODUCT.md: ERC-6551 direction ("architect for it, don't ship"), revenue philosophy (no V1 redistribution), $BOARD token reasoning, V1.5 Robinhood Market Layer, seat art philosophy ("history is rarity"), boardroom three-panel structure, design direction locked (financial terminal × competitive game), typography locked (Geist Sans + Geist Mono), activity feed format locked (HH:MM:SS tape format), seat number format fixed to three digits (#007), boardroom access clarified (ACTIVE or GRACE eligible).

Alternatives: Leave PRODUCT.md as-is, rely on brief as separate document.

Impact: PRODUCT.md is now the canonical source for all product decisions. CLAUDE.md updated with seat number format rule, boardroom access rule, design direction, and activity feed format. No contract changes. No economic changes.

---

## 2026-08-12 — Product direction: Productive Seat model

Decision: Extend BOARD from a pure social ownership game to contestable Seats around a productive onchain market position. ACTIVE Seats earn from the Board's underlying strategy revenue. GRACE pauses accrual (gap not retroactively filled). Ownership transfers atomically bank the old owner's accrued earnings and begin the new owner's accrual. Time-weighted globalIndex accounting (no snapshot-based approach).

New contract suite required:
- `MockRewardToken.sol` — test ERC-20 representing strategy yield
- `MockStrategyAdapter.sol` — simulated productive position (deposits MockRewardToken)
- `BoardRewardsVault.sol` — holds deposited rewards, routes to RewardAccounting
- `RewardAccounting.sol` — global index + per-seat index; hooks called by Board_v2 on lifecycle events
- `Board_v2.sol` — wraps Board.sol state machine with reward hooks; `rewardAccounting == address(0)` = no-op (backward compatible with existing 73 tests)

UI terminology: "Ask" replaces "Price" in consumer-facing display. Contract function names (`setSeatPrice`) stay unchanged.

Reason: Per founder Master Product + Build Spec (2026-08-12). Goal: prove that productive cashflow + self-assessed pricing + holding cost + forced takeover produces a compelling contestable ownership market. The pure social game proves behavior; the productive layer proves economics.

Alternatives: Keep pure social game (no earnings layer); add redistribution of holding costs (explicitly rejected — holding cost is a mechanism, not a fee to recycle).

Impact:
- Core Seat engine (Board.sol, 73 tests) unchanged — new contracts wrap it
- HOOD hardcoding must be removed across indexer, API routes, and frontend (parameterize boardId / BoardConfig)
- New DB tables: `reward_deposits`, `seat_reward_state`, `reward_claims`
- New API endpoints: `/api/boards/:boardId/rewards`, `/api/boards/:boardId/seats/:seatId/rewards`, `/api/profiles/:wallet/rewards`
- "Ask" display change is frontend-only (no contract change)
- Do NOT display estimated/guaranteed future APY — show only realized revenue (24h, 7d, 30d)
