-- ============================================================
-- Social Trading Platform — Postgres Schema
-- ============================================================
-- Target: Vercel Postgres (Neon) or Supabase
-- Run once via: psql $DATABASE_URL -f db/migrations/001_social_trading.sql
--
-- Naming conventions:
--   Tables:  snake_case plural (traders, social_trades)
--   Columns: snake_case (trader_id, entry_price)
--   Indexes: idx_{table}_{columns}
--   FKs:     fk_{table}_{ref}
-- ============================================================

-- Enable citext for case-insensitive usernames
CREATE EXTENSION IF NOT EXISTS citext;

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────
-- 1. TRADERS (user profiles)
-- ─────────────────────────────────────────────

CREATE TABLE traders (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username        CITEXT NOT NULL UNIQUE
                    CHECK (length(username) BETWEEN 3 AND 20)
                    CHECK (username ~ '^[a-z0-9_-]+$'),
  display_name    TEXT NOT NULL CHECK (length(display_name) <= 50),
  avatar_url      TEXT,
  bio             TEXT CHECK (bio IS NULL OR length(bio) <= 280),

  -- Verification
  verification    TEXT NOT NULL DEFAULT 'self-reported'
                    CHECK (verification IN ('self-reported','screenshot','broker-linked','exchange-api')),
  broker_source   TEXT,            -- 'alpaca', 'ibkr', 'robinhood', 'coinbase', etc.

  -- Auth
  email           TEXT NOT NULL UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT false,

  -- Social (denormalized counters — updated by triggers)
  follower_count  INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,

  -- Preferences
  default_asset_class TEXT CHECK (default_asset_class IN ('stocks','options','crypto','forex')),
  profile_public  BOOLEAN NOT NULL DEFAULT true,
  show_pnl_dollars BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_traders_email ON traders (email);
CREATE INDEX idx_traders_username ON traders (username);
CREATE INDEX idx_traders_verification ON traders (verification);

-- ─────────────────────────────────────────────
-- 2. SOCIAL TRADES (the core entity)
-- ─────────────────────────────────────────────

CREATE TABLE social_trades (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trader_id       TEXT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,

  -- Instrument
  symbol          TEXT NOT NULL,
  instrument_name TEXT,
  asset_class     TEXT NOT NULL CHECK (asset_class IN ('stocks','options','crypto','forex')),

  -- Position
  side            TEXT NOT NULL CHECK (side IN ('long','short')),
  strategy        TEXT NOT NULL CHECK (strategy IN ('daytrade','swing','scalp','position')),
  size            NUMERIC NOT NULL CHECK (size > 0),
  size_unit       TEXT DEFAULT 'shares',

  -- Entry
  entry_price     NUMERIC NOT NULL CHECK (entry_price > 0),
  entry_date      TIMESTAMPTZ NOT NULL,

  -- Exit (null while open)
  exit_price      NUMERIC CHECK (exit_price > 0 OR exit_price IS NULL),
  exit_date       TIMESTAMPTZ,

  -- Risk management
  stop_price      NUMERIC CHECK (stop_price > 0 OR stop_price IS NULL),
  target_price    NUMERIC CHECK (target_price > 0 OR target_price IS NULL),

  -- Context
  thesis          TEXT CHECK (thesis IS NULL OR length(thesis) <= 500),
  tags            TEXT[] NOT NULL DEFAULT '{}',

  -- Verification
  verification    TEXT NOT NULL DEFAULT 'self-reported'
                    CHECK (verification IN ('self-reported','screenshot','broker-linked','exchange-api')),
  broker_order_id TEXT,
  proof_hash      TEXT,            -- SHA-256 of broker fill confirmation

  -- Social engagement (denormalized)
  comment_count   INTEGER NOT NULL DEFAULT 0,
  reaction_count  INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Derived fields (materialized for query performance)
  -- Recomputed on INSERT/UPDATE via trigger
  status          TEXT GENERATED ALWAYS AS (
                    CASE WHEN exit_date IS NOT NULL AND exit_price IS NOT NULL
                         THEN 'closed' ELSE 'open' END
                  ) STORED,
  pnl_pct         NUMERIC GENERATED ALWAYS AS (
                    CASE
                      WHEN exit_price IS NOT NULL AND entry_price > 0 THEN
                        CASE side
                          WHEN 'long'  THEN ((exit_price - entry_price) / entry_price) * 100
                          WHEN 'short' THEN ((entry_price - exit_price) / entry_price) * 100
                        END
                      ELSE NULL
                    END
                  ) STORED,
  hold_duration_s INTEGER GENERATED ALWAYS AS (
                    CASE WHEN exit_date IS NOT NULL
                         THEN EXTRACT(EPOCH FROM (exit_date - entry_date))::integer
                         ELSE NULL END
                  ) STORED
);

-- Primary query patterns
CREATE INDEX idx_trades_trader_closed ON social_trades (trader_id, exit_date DESC NULLS LAST);
CREATE INDEX idx_trades_asset_closed ON social_trades (asset_class, exit_date DESC NULLS LAST);
CREATE INDEX idx_trades_symbol ON social_trades (symbol);
CREATE INDEX idx_trades_status ON social_trades (status);
CREATE INDEX idx_trades_created ON social_trades (created_at DESC);
CREATE INDEX idx_trades_feed ON social_trades (created_at DESC) WHERE status = 'closed';

-- Feed query: newest closed trades with filters
CREATE INDEX idx_trades_feed_asset ON social_trades (asset_class, created_at DESC)
  WHERE status = 'closed';

-- ─────────────────────────────────────────────
-- 3. TRADER STATS (materialized, rebuilt by cron)
-- ─────────────────────────────────────────────

CREATE TABLE trader_stats (
  trader_id       TEXT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  period          TEXT NOT NULL CHECK (period IN ('1d','1w','1m','3m','ytd','1y','all')),
  asset_class     TEXT NOT NULL DEFAULT 'all',
  side            TEXT NOT NULL DEFAULT 'both',

  total_trades    INTEGER NOT NULL DEFAULT 0,
  closed_trades   INTEGER NOT NULL DEFAULT 0,
  open_trades     INTEGER NOT NULL DEFAULT 0,
  wins            INTEGER NOT NULL DEFAULT 0,
  losses          INTEGER NOT NULL DEFAULT 0,
  breakeven       INTEGER NOT NULL DEFAULT 0,

  win_rate        NUMERIC NOT NULL DEFAULT 0,
  win_rate_wilson NUMERIC NOT NULL DEFAULT 0,

  total_pnl_pct   NUMERIC NOT NULL DEFAULT 0,
  avg_win_pct     NUMERIC NOT NULL DEFAULT 0,
  avg_loss_pct    NUMERIC NOT NULL DEFAULT 0,
  profit_factor   NUMERIC,
  expectancy      NUMERIC NOT NULL DEFAULT 0,
  avg_r_multiple  NUMERIC,

  sharpe          NUMERIC,
  sortino         NUMERIC,
  max_drawdown_pct NUMERIC NOT NULL DEFAULT 0,
  max_losing_streak INTEGER NOT NULL DEFAULT 0,

  avg_hold_duration_s INTEGER NOT NULL DEFAULT 0,
  avg_hold_duration_label TEXT NOT NULL DEFAULT '',

  best_trade_pnl_pct  NUMERIC NOT NULL DEFAULT 0,
  worst_trade_pnl_pct NUMERIC NOT NULL DEFAULT 0,
  best_trade_id       TEXT,
  worst_trade_id      TEXT,

  equity_curve    JSONB NOT NULL DEFAULT '[]',

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (trader_id, period, asset_class, side)
);

-- Leaderboard queries: sort by any metric within a period/asset/side
CREATE INDEX idx_stats_sharpe ON trader_stats (period, asset_class, side, sharpe DESC NULLS LAST)
  WHERE closed_trades >= 5;
CREATE INDEX idx_stats_profit_factor ON trader_stats (period, asset_class, side, profit_factor DESC NULLS LAST)
  WHERE closed_trades >= 5;
CREATE INDEX idx_stats_pnl ON trader_stats (period, asset_class, side, total_pnl_pct DESC)
  WHERE closed_trades >= 5;
CREATE INDEX idx_stats_win_rate ON trader_stats (period, asset_class, side, win_rate_wilson DESC)
  WHERE closed_trades >= 5;

-- ─────────────────────────────────────────────
-- 4. FOLLOWS (social graph)
-- ─────────────────────────────────────────────

CREATE TABLE follows (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  follower_id     TEXT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  followee_id     TEXT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  notify_mode     TEXT NOT NULL DEFAULT 'realtime'
                    CHECK (notify_mode IN ('realtime','daily','off')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (follower_id, followee_id),
  CHECK (follower_id != followee_id)
);

CREATE INDEX idx_follows_follower ON follows (follower_id);
CREATE INDEX idx_follows_followee ON follows (followee_id);

-- ─────────────────────────────────────────────
-- 5. COMMENTS
-- ─────────────────────────────────────────────

CREATE TABLE trade_comments (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trade_id        TEXT NOT NULL REFERENCES social_trades(id) ON DELETE CASCADE,
  trader_id       TEXT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  parent_id       TEXT REFERENCES trade_comments(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_trade ON trade_comments (trade_id, created_at);
CREATE INDEX idx_comments_parent ON trade_comments (parent_id) WHERE parent_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 6. REACTIONS
-- ─────────────────────────────────────────────

CREATE TABLE trade_reactions (
  trade_id        TEXT NOT NULL REFERENCES social_trades(id) ON DELETE CASCADE,
  trader_id       TEXT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('fire','eyes','skull','100','chart')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (trade_id, trader_id)    -- One reaction per user per trade
);

CREATE INDEX idx_reactions_trade ON trade_reactions (trade_id);

-- ─────────────────────────────────────────────
-- 7. NOTIFICATIONS
-- ─────────────────────────────────────────────

CREATE TABLE notifications (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  recipient_id    TEXT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
    'trade_opened','trade_closed','new_follower',
    'comment','reaction','rank_change','milestone'
  )),
  payload         JSONB NOT NULL DEFAULT '{}',
  read            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, read, created_at DESC);

-- ─────────────────────────────────────────────
-- 8. SAVED VIEWS (filter presets)
-- ─────────────────────────────────────────────

CREATE TABLE saved_views (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trader_id       TEXT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  query           JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_views_trader ON saved_views (trader_id);

-- ─────────────────────────────────────────────
-- 9. TRIGGERS — keep denormalized counters in sync
-- ─────────────────────────────────────────────

-- Follow counter
CREATE OR REPLACE FUNCTION update_follow_counts() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE traders SET follower_count = follower_count + 1 WHERE id = NEW.followee_id;
    UPDATE traders SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE traders SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.followee_id;
    UPDATE traders SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Comment counter
CREATE OR REPLACE FUNCTION update_comment_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_trades SET comment_count = comment_count + 1 WHERE id = NEW.trade_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_trades SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.trade_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_count
  AFTER INSERT OR DELETE ON trade_comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- Reaction counter
CREATE OR REPLACE FUNCTION update_reaction_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_trades SET reaction_count = reaction_count + 1 WHERE id = NEW.trade_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_trades SET reaction_count = GREATEST(reaction_count - 1, 0) WHERE id = OLD.trade_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reaction_count
  AFTER INSERT OR DELETE ON trade_reactions
  FOR EACH ROW EXECUTE FUNCTION update_reaction_count();

-- updated_at auto-touch
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_traders_updated_at
  BEFORE UPDATE ON traders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_trades_updated_at
  BEFORE UPDATE ON social_trades FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON trade_comments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─────────────────────────────────────────────
-- 10. SEED DATA (optional — remove in prod)
-- ─────────────────────────────────────────────

-- Uncomment to create Mario as the first trader:
-- INSERT INTO traders (id, username, display_name, email, email_verified, verification)
-- VALUES ('mario-001', 'mario', 'Mario', 'mario@buyorbesold.com', true, 'self-reported');
