# Economics

Reference for the V1 economic parameters. Source of truth is `PRODUCT.md` and `BUILD_SPEC.md`.

---

## V1 Parameters

| Parameter | Value |
|---|---|
| Board | HOOD |
| Seat count | 100 |
| Vacant Seat price | $10 |
| Holding rate | 0.5% per week |
| Grace period | 72 hours |
| Seller share on takeover | 95% |
| Protocol fee on takeover | 5% |
| Minimum initial holding coverage | 2 weeks |

---

## Holding Cost Formula

```
holding cost = seat_price × (0.005 / 604800) × elapsed_seconds
```

Where `604800` = seconds in 7 days.

No floating point. Use fixed-point integer arithmetic. Document rounding behavior in contract.

---

## Seat Lifecycle Economics

**Taking a vacant Seat:**
```
User pays:  $10 (vacant price) + prepaid holding balance
            prepaid balance must cover ≥ 2 weeks at chosen price
```

**Takeover of occupied Seat:**
```
Buyer pays:     seat_price + new prepaid holding balance
Seller gets:    95% of seat_price + remaining prepaid balance (after accrued fees)
Protocol gets:  5% of seat_price
```

**Grace:**
```
Triggered when: effective_prepaid_balance ≤ 0
Duration:       72 hours from balance depletion timestamp
Recovery:       top-up any amount → Seat returns ACTIVE
Expiry:         anyone may call forecloseSeat after 72 hours
```

**Foreclosure:**
```
Seat → VACANT at protocol's $10 vacant price
Previous owner: nothing (balance was exhausted)
Seat identity: preserved permanently
```

---

## Coverage Calculation

```
weekly_cost          = seat_price × 0.005
daily_cost           = weekly_cost / 7
effective_balance    = prepaid_balance - accrued_fees_since_last_settlement
weeks_remaining      = effective_balance / weekly_cost
depletion_timestamp  = last_settled_at + (prepaid_balance / rate_per_second)
grace_ends_at        = depletion_timestamp + 72 hours
```
