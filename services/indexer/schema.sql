-- Board indexer schema
-- Run once against your Postgres database.
-- Re-running is safe (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS boards (
  id               TEXT PRIMARY KEY,
  name             TEXT        NOT NULL,
  chain_id         INTEGER     NOT NULL,
  contract_address TEXT        NOT NULL,
  seat_count       INTEGER     NOT NULL DEFAULT 100,
  deployment_block BIGINT      NOT NULL,
  settlement_asset TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row, tracks how far we've indexed
CREATE TABLE IF NOT EXISTS indexer_state (
  id                 TEXT PRIMARY KEY DEFAULT 'singleton',
  last_indexed_block BIGINT      NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Live projection of each seat's current state
CREATE TABLE IF NOT EXISTS seats (
  board_id              TEXT        NOT NULL REFERENCES boards(id),
  seat_id               INTEGER     NOT NULL,
  owner                 TEXT,                   -- null = VACANT
  price                 NUMERIC,
  prepaid_balance       NUMERIC,
  last_settled_at       TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'VACANT',
  estimated_depletion_at TIMESTAMPTZ,
  grace_ends_at         TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_block         BIGINT,
  PRIMARY KEY (board_id, seat_id)
);

-- Immutable event log — idempotent by (tx_hash, log_index)
CREATE TABLE IF NOT EXISTS seat_events (
  id              BIGSERIAL   PRIMARY KEY,
  board_id        TEXT        NOT NULL REFERENCES boards(id),
  seat_id         INTEGER     NOT NULL,
  event_type      TEXT        NOT NULL,
  tx_hash         TEXT        NOT NULL,
  log_index       INTEGER     NOT NULL,
  block_number    BIGINT      NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  actor           TEXT,
  previous_owner  TEXT,
  new_owner       TEXT,
  amount          NUMERIC,
  previous_price  NUMERIC,
  new_price       NUMERIC,
  metadata        JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL,
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS seat_events_seat_idx   ON seat_events (board_id, seat_id);
CREATE INDEX IF NOT EXISTS seat_events_block_idx  ON seat_events (block_number);
CREATE INDEX IF NOT EXISTS seat_events_actor_idx  ON seat_events (actor);
CREATE INDEX IF NOT EXISTS seats_owner_idx        ON seats (owner) WHERE owner IS NOT NULL;
CREATE INDEX IF NOT EXISTS seats_status_idx       ON seats (status);
