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

-- Reward accounting tables

-- One row per RewardDeposited event from RewardAccounting
CREATE TABLE IF NOT EXISTS reward_deposits (
  id              BIGSERIAL   PRIMARY KEY,
  board_id        TEXT        NOT NULL REFERENCES boards(id),
  amount          NUMERIC     NOT NULL,
  global_index    NUMERIC     NOT NULL,
  active_seat_count INTEGER   NOT NULL,
  tx_hash         TEXT        NOT NULL,
  log_index       INTEGER     NOT NULL,
  block_number    BIGINT      NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  UNIQUE (tx_hash, log_index)
);

-- Live projection of per-seat reward state
CREATE TABLE IF NOT EXISTS seat_reward_state (
  board_id          TEXT    NOT NULL REFERENCES boards(id),
  seat_id           INTEGER NOT NULL,
  cumulative_banked NUMERIC NOT NULL DEFAULT 0,
  last_updated_block BIGINT,
  last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, seat_id)
);

-- One row per RewardClaimed event from RewardAccounting
CREATE TABLE IF NOT EXISTS reward_claims (
  id              BIGSERIAL   PRIMARY KEY,
  board_id        TEXT        NOT NULL REFERENCES boards(id),
  owner           TEXT        NOT NULL,
  amount          NUMERIC     NOT NULL,
  tx_hash         TEXT        NOT NULL,
  log_index       INTEGER     NOT NULL,
  block_number    BIGINT      NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS reward_deposits_board_idx  ON reward_deposits (board_id);
CREATE INDEX IF NOT EXISTS reward_deposits_block_idx  ON reward_deposits (block_number);
CREATE INDEX IF NOT EXISTS seat_reward_state_seat_idx ON seat_reward_state (board_id, seat_id);
CREATE INDEX IF NOT EXISTS reward_claims_owner_idx    ON reward_claims (owner);
CREATE INDEX IF NOT EXISTS reward_claims_board_idx    ON reward_claims (board_id);
