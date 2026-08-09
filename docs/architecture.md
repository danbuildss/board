# Architecture

_To be written during Phase 1._

See `BUILD_SPEC.md` for the engineering specification this architecture implements.

---

## Overview

```
Robinhood Chain
  └── Board.sol
        ├── Seat ownership (ERC-721 internally, transfer-restricted)
        ├── Holding balance per Seat
        ├── Lazy fee accrual
        ├── Grace / foreclosure state machine
        └── Protocol fee collection

Indexer (services/indexer/)
  └── Reads contract events
  └── Writes projections to Postgres

Backend API (apps/web/ or separate service)
  └── Serves projected state
  └── Boardroom authorization
  └── Notification scheduling
  └── Share card generation

Frontend (apps/web/)
  └── Next.js + viem + wagmi
  └── Writes go onchain directly from user wallet
  └── Reads from API + contract view functions
```

---

## Source of Truth Hierarchy

1. Blockchain (Board.sol) — economic state
2. Indexer projections (Postgres) — readable state
3. Frontend/API — display only
