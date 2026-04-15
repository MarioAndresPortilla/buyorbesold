-- User-editable watchlists. Keyed by user email (the JWT `sub`), since a session
-- may exist before the user has a traders row (onboarding is optional).
-- 10-symbol cap is enforced in application code; DB just stores one row per pick.

CREATE TABLE IF NOT EXISTS user_watchlists (
  id          BIGSERIAL PRIMARY KEY,
  user_email  TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_watchlists_unique UNIQUE (user_email, symbol),
  CONSTRAINT user_watchlists_symbol_len CHECK (char_length(symbol) BETWEEN 1 AND 16)
);

CREATE INDEX IF NOT EXISTS user_watchlists_email_idx
  ON user_watchlists (user_email, position);
