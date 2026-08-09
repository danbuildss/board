# API

_To be written during Phase 1 (P4 — Backend API)._

See `BUILD_SPEC.md` → "APIs" for the required endpoints.

---

## Endpoints

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

All economic writes happen onchain. The API is read-only for economic state.
