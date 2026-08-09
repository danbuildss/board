# BACKEND_PROOF.md

Status: **INCOMPLETE — P2 ✅ deployed, lifecycle proof pending**

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
| Deployment block | 98751649 |
| Deploy tx | 0xa313abe4eba795d9ad284da9a3fbc8c92fa685fc92e6bc4febdb7fe233bb11ac |
| Deployer | 0x69ff8eC5B523E334c328c0Dc60391E7643494D6c |

---

## Contracts

| Contract | Address | Block |
|---|---|---|
| Board | 0x0a3932a24dCC9Bbd7BFC448Da99265EC58F806DB | 98751649 |

---

## Tests

```
Unit:       62 / 62  ✅
Fuzz:        7 / 7   ✅  (1000 runs each)
Invariant:   4 / 4   ✅  (256 runs × 50 depth = 12,800 calls/invariant)
Integration: 0       (planned post-testnet)
Total:      73 / 73  ✅
```

---

## Real Testnet Lifecycle

_All transactions to be recorded after testnet deployment._

### Scenario 1 — Take Vacant Seat

- Wallet: _TBD_
- Seat: _TBD_
- tx: _TBD_

### Scenario 2 — Reprice

- tx: _TBD_

### Scenario 3 — Top-up

- tx: _TBD_

### Scenario 4 — Takeover

- Buyer wallet: _TBD_
- tx: _TBD_

### Scenario 5 — Grace (balance depletion)

- Seat enters grace: tx _TBD_

### Scenario 6 — Grace Recovery (top-up during grace)

- tx: _TBD_

### Scenario 7 — Second Depletion

- tx: _TBD_

### Scenario 8 — Foreclosure

- tx: _TBD_

### Scenario 9 — Same Seat Taken Again Post-Foreclosure

- tx: _TBD_

---

## Accounting

_To be filled after Scenario 4 (takeover). Must reconcile:_
- buyer wallet before/after
- seller wallet before/after
- Board contract before/after
- treasury before/after
- remaining prepaid balance

---

## Indexer

_P3 — not started._

- [ ] Proves restart and replay produce identical state
- [ ] Handles duplicate block delivery
- [ ] Can rebuild from block 0

---

## API

_P4 — not started._

- [ ] API state matches contract state for all 9 lifecycle states

---

## Known Issues

_None at this time. Do not declare backend proven with unresolved critical issues._
