-- ============================================================
-- Congress Trade Monitor — Postgres Schema
-- ============================================================
-- Tracks STOCK Act disclosures pulled from Finnhub (and later:
-- CapitolTrades backfill). Members are materialized from the
-- trade stream — the first time a name appears, we insert a
-- congress_members row with a slug derived from the name.
--
-- Run once via: psql $DATABASE_URL -f db/migrations/002_congress.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. CONGRESS_MEMBERS
-- ─────────────────────────────────────────────
-- id is a url-safe slug: "nancy-pelosi", "dan-crenshaw".
-- raw_name preserves whatever the filing source returned so we
-- can re-derive the slug if our slugifier changes.

CREATE TABLE congress_members (
  id              TEXT PRIMARY KEY,
  raw_name        TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  chamber         TEXT CHECK (chamber IN ('house','senate','unknown')) NOT NULL DEFAULT 'unknown',
  party           TEXT CHECK (party IN ('D','R','I','unknown')) NOT NULL DEFAULT 'unknown',
  state           TEXT,
  photo_url       TEXT,

  -- Denormalized counters (updated by sync cron)
  total_trades    INTEGER NOT NULL DEFAULT 0,
  last_traded_at  TIMESTAMPTZ,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_congress_members_chamber ON congress_members (chamber);
CREATE INDEX idx_congress_members_last_traded ON congress_members (last_traded_at DESC NULLS LAST);

-- ─────────────────────────────────────────────
-- 2. CONGRESS_TRADES
-- ─────────────────────────────────────────────
-- STOCK Act disclosures are dollar-range not exact amount.
-- amount_low/high bracket the range; we use midpoint for sizing.
-- Dedupe key: (member_id, symbol, transaction_date, transaction_type, amount_low)
-- — Finnhub doesn't always expose filing_id, so this tuple is how we
-- guarantee idempotent inserts across nightly syncs.

CREATE TABLE congress_trades (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id         TEXT NOT NULL REFERENCES congress_members(id) ON DELETE CASCADE,

  symbol            TEXT NOT NULL,
  asset_name        TEXT,

  transaction_type  TEXT NOT NULL CHECK (transaction_type IN ('buy','sell','exchange','other')),
  transaction_date  DATE NOT NULL,
  filing_date       DATE,

  amount_low        NUMERIC,
  amount_high       NUMERIC,
  amount_mid        NUMERIC GENERATED ALWAYS AS (
                      CASE
                        WHEN amount_low IS NOT NULL AND amount_high IS NOT NULL
                          THEN (amount_low + amount_high) / 2
                        WHEN amount_low IS NOT NULL THEN amount_low
                        WHEN amount_high IS NOT NULL THEN amount_high
                        ELSE NULL
                      END
                    ) STORED,

  owner_type        TEXT,       -- 'self', 'spouse', 'joint', 'dependent', etc.
  position          TEXT,       -- chamber position at time of filing

  source            TEXT NOT NULL DEFAULT 'finnhub',
  filing_id         TEXT,       -- when source exposes a stable id

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedupe — enforced at insert with ON CONFLICT DO NOTHING
CREATE UNIQUE INDEX idx_congress_trades_dedupe ON congress_trades (
  member_id, symbol, transaction_date, transaction_type, COALESCE(amount_low, 0)
);

CREATE INDEX idx_congress_trades_member ON congress_trades (member_id, transaction_date DESC);
CREATE INDEX idx_congress_trades_symbol ON congress_trades (symbol, transaction_date DESC);
CREATE INDEX idx_congress_trades_date ON congress_trades (transaction_date DESC);
CREATE INDEX idx_congress_trades_filing ON congress_trades (filing_date DESC NULLS LAST);

-- ─────────────────────────────────────────────
-- 3. CONGRESS_MEMBER_STATS (materialized)
-- ─────────────────────────────────────────────
-- Recomputed by the nightly stats cron after the trade sync.
-- timing_alpha_pct = member's trade-weighted return minus SPY's return
-- over the same holding window (default 30-day forward look).

CREATE TABLE congress_member_stats (
  member_id             TEXT NOT NULL REFERENCES congress_members(id) ON DELETE CASCADE,
  period                TEXT NOT NULL CHECK (period IN ('1m','3m','ytd','1y','all')),

  total_trades          INTEGER NOT NULL DEFAULT 0,
  buy_count             INTEGER NOT NULL DEFAULT 0,
  sell_count            INTEGER NOT NULL DEFAULT 0,
  unique_symbols        INTEGER NOT NULL DEFAULT 0,

  -- Estimated $ size — sum of midpoints across trades in range
  est_volume_usd        NUMERIC NOT NULL DEFAULT 0,

  -- Timing alpha: avg 30-day forward return on buys, inverted on sells,
  -- minus SPY's return over the same window. Positive = beat the market.
  timing_alpha_30d_pct  NUMERIC,
  timing_alpha_90d_pct  NUMERIC,

  -- Directional accuracy: % of trades where the forward move
  -- went the member's way (buy + stock up, sell + stock down).
  win_rate_30d          NUMERIC,

  avg_forward_return_30d_pct NUMERIC,

  -- Concentration
  top_symbol            TEXT,
  top_symbol_trades     INTEGER,

  -- Filter-qualifier flag — leaderboard excludes non-qualifiers
  qualifies             BOOLEAN NOT NULL DEFAULT false,

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (member_id, period)
);

-- Leaderboard query: sort by timing_alpha within a period, qualifying members only
CREATE INDEX idx_congress_stats_alpha ON congress_member_stats
  (period, timing_alpha_30d_pct DESC NULLS LAST) WHERE qualifies = true;
CREATE INDEX idx_congress_stats_volume ON congress_member_stats
  (period, est_volume_usd DESC) WHERE qualifies = true;
CREATE INDEX idx_congress_stats_trades ON congress_member_stats
  (period, total_trades DESC);

-- ─────────────────────────────────────────────
-- 4. CONGRESS_PRICE_SNAPSHOTS
-- ─────────────────────────────────────────────
-- Cached daily closes for SPY + traded symbols. Keeps the stats
-- cron from hammering Yahoo on every recomputation. One row per
-- (symbol, date). Populated by the sync cron as it encounters
-- new trades, and trimmed to the last 2 years by a periodic job.

CREATE TABLE congress_price_snapshots (
  symbol            TEXT NOT NULL,
  date              DATE NOT NULL,
  close             NUMERIC NOT NULL,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (symbol, date)
);

CREATE INDEX idx_congress_prices_symbol_date ON congress_price_snapshots (symbol, date DESC);

-- ─────────────────────────────────────────────
-- 5. CONGRESS_WATCH (user opt-in alerts)
-- ─────────────────────────────────────────────
-- Stores an email address tied to a member they want alerts for.
-- We keep this detached from traders(id) so non-logged-in users
-- can subscribe via magic-link confirmation later if we add it.

CREATE TABLE congress_watch (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email             TEXT NOT NULL,
  member_id         TEXT NOT NULL REFERENCES congress_members(id) ON DELETE CASCADE,
  confirmed         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_notified_at  TIMESTAMPTZ,

  UNIQUE (email, member_id)
);

CREATE INDEX idx_congress_watch_member ON congress_watch (member_id) WHERE confirmed = true;
CREATE INDEX idx_congress_watch_email ON congress_watch (email);

-- ─────────────────────────────────────────────
-- 6. TRIGGERS
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_congress_members_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_congress_members_updated_at
  BEFORE UPDATE ON congress_members
  FOR EACH ROW EXECUTE FUNCTION touch_congress_members_updated_at();
