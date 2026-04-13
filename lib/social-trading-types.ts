/**
 * Social Trading Platform — Data Model
 * =====================================
 *
 * Extends the existing single-admin journal into a multi-user social
 * trading platform with verified leaderboards, trade feeds, and
 * social features (follow, comment, react).
 *
 * STORAGE RECOMMENDATION:
 * -----------------------
 * Vercel KV (Redis) cannot support the relational queries this model
 * requires (leaderboard sorts with filters, follower graphs, aggregations).
 * Migrate to Vercel Postgres (Neon) or Supabase. Keep KV for:
 *   - Rate limiting (existing)
 *   - Session cache
 *   - Real-time feed cache (sorted sets)
 *   - Leaderboard snapshot cache (sorted sets, rebuild hourly)
 *
 * INDEX STRATEGY (Postgres):
 * --------------------------
 * trades:       (trader_id, closed_at), (asset_class, closed_at), (symbol)
 * trader_stats: (period, asset_class, side, sort_key DESC)
 * follows:      (follower_id), (followee_id)
 * comments:     (trade_id, created_at)
 */

// ─────────────────────────────────────────────
// Enums / Literals
// ─────────────────────────────────────────────

export type AssetClass = "stocks" | "options" | "crypto" | "forex";

export type StrategyTag = "daytrade" | "swing" | "scalp" | "position";

export type VerificationLevel =
  | "self-reported"  // Manual entry, no proof
  | "screenshot"     // User uploaded fill screenshot (weak)
  | "broker-linked"  // OAuth or API key to broker (Alpaca, IBKR, Tradier)
  | "exchange-api";  // Direct exchange feed (crypto CEX/DEX)

export type TradeSide = "long" | "short";
export type TradeStatus = "open" | "closed";
export type TradeOutcome = "win" | "loss" | "breakeven";

export type RankPeriod = "1d" | "1w" | "1m" | "3m" | "ytd" | "1y" | "all";

export type RankSortKey =
  | "sharpe"
  | "profit_factor"
  | "total_pnl_pct"
  | "win_rate"
  | "expectancy"
  | "avg_r_multiple";

export type NotificationType =
  | "trade_opened"     // Followed trader opened a position
  | "trade_closed"     // Followed trader closed a position
  | "new_follower"     // Someone followed you
  | "comment"          // Someone commented on your trade
  | "reaction"         // Someone reacted to your trade
  | "rank_change"      // Your rank moved significantly
  | "milestone";       // Achievement (100 trades, 60% win rate, etc.)

export type ReactionType = "fire" | "eyes" | "skull" | "100" | "chart";

// ─────────────────────────────────────────────
// Trader (User Profile)
// ─────────────────────────────────────────────

export interface Trader {
  id: string;                    // ULID — sortable, globally unique
  username: string;              // Unique, lowercase, 3-20 chars, [a-z0-9_-]
  displayName: string;           // Free text, max 50 chars
  avatarUrl?: string;            // CDN URL or null for default avatar
  bio?: string;                  // Max 280 chars
  verification: VerificationLevel;
  brokerSource?: string;         // e.g. "alpaca", "ibkr", "robinhood", "coinbase"

  // Auth
  email: string;                 // Unique, used for magic-link login
  emailVerified: boolean;

  // Social counts (denormalized for fast reads — updated via trigger/job)
  followerCount: number;
  followingCount: number;

  // Preferences
  defaultAssetClass?: AssetClass;
  profilePublic: boolean;        // false = trades hidden from feed & rankings
  showPnlDollars: boolean;       // false = only show % (privacy for large accounts)

  createdAt: string;             // ISO 8601
  updatedAt: string;
}

export interface TraderPublicProfile extends Omit<Trader,
  "email" | "emailVerified" | "updatedAt"
> {
  /** Precomputed "all-time" stats snapshot for the profile hero card. */
  statsSnapshot?: TraderStats;
}

// ─────────────────────────────────────────────
// Trade Event (core entity)
// ─────────────────────────────────────────────

export interface SocialTrade {
  id: string;                    // ULID
  traderId: string;              // FK → Trader.id

  // Instrument
  symbol: string;                // Uppercase: "AAPL", "ETH", "EUR/USD"
  instrumentName?: string;       // "Apple Inc.", "Ethereum", etc.
  assetClass: AssetClass;

  // Position
  side: TradeSide;
  strategy: StrategyTag;
  size: number;                  // Shares, contracts, or units
  sizeUnit?: string;             // "shares" | "contracts" | "coins" | "lots"

  // Entry
  entryPrice: number;
  entryDate: string;             // ISO 8601

  // Exit (null while open)
  exitPrice?: number;
  exitDate?: string;

  // Risk management
  stopPrice?: number;
  targetPrice?: number;

  // Context
  thesis?: string;               // Max 500 chars — why you took this trade
  tags: string[];                // Free-form: ["earnings", "momentum", "gap-fill"]

  // Verification
  verification: VerificationLevel;
  brokerOrderId?: string;        // External reference for broker-linked trades
  /** SHA-256 hash of broker fill confirmation (for audit trail). */
  proofHash?: string;

  // Social engagement (denormalized counts)
  commentCount: number;
  reactionCount: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // ── Derived fields (computed at read time, never stored) ──

  status?: TradeStatus;
  outcome?: TradeOutcome;
  pnl?: number;                  // Absolute P&L in instrument currency
  pnlPct?: number;               // % return on entry
  rMultiple?: number;            // Reward / risk (requires stopPrice)
  holdDurationMs?: number;       // Exit - entry in milliseconds
  holdDurationLabel?: string;    // "2h 14m", "3d", "6w 2d"
}

/**
 * Validated input for creating a new trade.
 * Omits derived fields, IDs, and timestamps.
 */
export interface SocialTradeInput {
  symbol: string;
  assetClass: AssetClass;
  side: TradeSide;
  strategy: StrategyTag;
  size: number;
  sizeUnit?: string;
  entryPrice: number;
  entryDate: string;
  exitPrice?: number;
  exitDate?: string;
  stopPrice?: number;
  targetPrice?: number;
  thesis?: string;
  tags?: string[];
}

/**
 * Partial update for closing or amending a trade.
 */
export interface SocialTradeUpdate {
  exitPrice?: number;
  exitDate?: string;
  stopPrice?: number;
  targetPrice?: number;
  thesis?: string;
  tags?: string[];
}

// ─────────────────────────────────────────────
// Trader Stats (materialized / cached)
// ─────────────────────────────────────────────
//
// Recomputed hourly (or on trade close) and cached.
// One row per (traderId, period, assetClass, side) tuple.
// "all" asset class / "both" side = aggregate across that dimension.

export interface TraderStats {
  traderId: string;

  // Filter dimensions — what this stat row covers
  period: RankPeriod;
  assetClass: AssetClass | "all";
  side: TradeSide | "both";

  // Volume
  totalTrades: number;
  closedTrades: number;
  openTrades: number;

  // Win / loss
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;                // 0-100

  /**
   * Wilson score lower bound for win rate at 95% confidence.
   * Used for ranking instead of raw winRate to penalize small sample sizes.
   * A trader with 5/5 wins scores ~56%, while 500/600 scores ~81%.
   */
  winRateWilson: number;         // 0-100

  // Returns
  totalPnlPct: number;           // Cumulative % return
  avgWinPct: number;             // Average winner size (%)
  avgLossPct: number;            // Average loser size (%, negative)

  // Risk-adjusted metrics
  /**
   * Profit factor = gross wins / gross losses.
   * >1 = profitable system, >2 = strong edge, >3 = exceptional.
   * null if no losses (division by zero).
   */
  profitFactor: number | null;

  /**
   * Expected value per trade in % terms.
   * (winRate * avgWin) + (lossRate * avgLoss)
   */
  expectancy: number;

  /**
   * Average R-multiple across all closed trades with defined stops.
   * null if no trades had stop prices set.
   */
  avgRMultiple: number | null;

  /**
   * Annualized Sharpe ratio of trade returns.
   * Uses per-trade returns, annualized by sqrt(tradesPerYear).
   * null if fewer than 5 closed trades (not statistically meaningful).
   */
  sharpe: number | null;

  /**
   * Sortino ratio — like Sharpe but only penalizes downside volatility.
   * Better measure for traders who have occasional large winners.
   */
  sortino: number | null;

  /**
   * Maximum peak-to-trough drawdown in cumulative % equity curve.
   * Expressed as a negative percentage (e.g., -14.2).
   */
  maxDrawdownPct: number;

  /**
   * Maximum consecutive losing trades.
   */
  maxLosingStreak: number;

  // Timing
  avgHoldDurationMs: number;     // Average hold time across closed trades
  avgHoldDurationLabel: string;  // Human-readable: "4h 12m", "2d 6h"

  // Best / worst
  bestTradePnlPct: number;
  worstTradePnlPct: number;
  bestTradeId?: string;
  worstTradeId?: string;

  // Equity curve — array of points for sparkline rendering
  equityCurve: EquityCurvePoint[];

  // Meta
  computedAt: string;            // ISO 8601 — when these stats were last built
}

export interface EquityCurvePoint {
  /** ISO date (YYYY-MM-DD) or timestamp for intraday. */
  date: string;
  /** Cumulative % return at this point. */
  cumulativePnlPct: number;
  /** Running trade count at this point. */
  tradeCount: number;
}

// ─────────────────────────────────────────────
// Leaderboard / Rankings
// ─────────────────────────────────────────────

/**
 * One row in a ranked leaderboard view.
 * Materialized hourly from TraderStats.
 */
export interface RankEntry {
  rank: number;
  traderId: string;

  // Denormalized trader fields for rendering without a join
  username: string;
  displayName: string;
  avatarUrl?: string;
  verification: VerificationLevel;

  // The filter context this ranking applies to
  period: RankPeriod;
  assetClass: AssetClass | "all";
  side: TradeSide | "both";
  sortedBy: RankSortKey;

  // The primary sort value
  sortValue: number;

  // Key stats shown inline (avoids loading full TraderStats per row)
  winRate: number;
  winRateWilson: number;
  closedTrades: number;
  totalPnlPct: number;
  profitFactor: number | null;
  sharpe: number | null;
  maxDrawdownPct: number;
  avgRMultiple: number | null;
  equityCurve: EquityCurvePoint[];

  /**
   * Minimum closed trades required to appear on the leaderboard.
   * Varies by period: 1d=1, 1w=3, 1m=10, 3m=25, ytd/1y=50, all=100.
   */
  meetsMinTrades: boolean;
}

/**
 * Query parameters for fetching the leaderboard.
 */
export interface RankQuery {
  period: RankPeriod;
  assetClass?: AssetClass;       // Default: "all"
  side?: TradeSide;              // Default: "both"
  sortBy?: RankSortKey;          // Default: "sharpe"
  verifiedOnly?: boolean;        // Default: true
  limit?: number;                // Default: 50
  offset?: number;               // Default: 0
}

/**
 * Minimum trade counts per period to qualify for rankings.
 * Prevents gaming by taking 1 lucky trade and sitting at #1.
 */
export const RANK_MIN_TRADES: Record<RankPeriod, number> = {
  "1d": 1,
  "1w": 3,
  "1m": 10,
  "3m": 25,
  ytd: 50,
  "1y": 50,
  all: 100,
};

// ─────────────────────────────────────────────
// Social Graph
// ─────────────────────────────────────────────

export interface Follow {
  id: string;
  followerId: string;            // The user doing the following
  followeeId: string;            // The trader being followed
  createdAt: string;
  /** Optional: get notified on every trade, or just daily digest. */
  notifyMode: "realtime" | "daily" | "off";
}

// ─────────────────────────────────────────────
// Trade Comments & Reactions
// ─────────────────────────────────────────────

export interface TradeComment {
  id: string;
  tradeId: string;               // FK → SocialTrade.id
  traderId: string;              // FK → Trader.id (the commenter)
  body: string;                  // Max 500 chars, plain text
  createdAt: string;
  updatedAt: string;
  /** Nested replies — max 1 level deep. null = top-level comment. */
  parentId?: string;
}

export interface TradeReaction {
  tradeId: string;
  traderId: string;
  type: ReactionType;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────

export interface Notification {
  id: string;
  recipientId: string;           // FK → Trader.id
  type: NotificationType;
  /** Structured payload — varies by type. */
  payload: NotificationPayload;
  read: boolean;
  createdAt: string;
}

export type NotificationPayload =
  | { type: "trade_opened"; traderId: string; tradeId: string; symbol: string; side: TradeSide }
  | { type: "trade_closed"; traderId: string; tradeId: string; symbol: string; pnlPct: number }
  | { type: "new_follower"; followerId: string; followerUsername: string }
  | { type: "comment"; commentId: string; tradeId: string; commenterUsername: string }
  | { type: "reaction"; tradeId: string; reactorUsername: string; reactionType: ReactionType }
  | { type: "rank_change"; period: RankPeriod; oldRank: number; newRank: number }
  | { type: "milestone"; label: string; detail: string };

// ─────────────────────────────────────────────
// Trade Feed
// ─────────────────────────────────────────────

/**
 * Query parameters for the public trade feed.
 */
export interface FeedQuery {
  /** Show only trades from followed traders. */
  followedOnly?: boolean;
  /** Filter by trader. */
  traderId?: string;
  /** Filter by asset class. */
  assetClass?: AssetClass;
  /** Filter by strategy. */
  strategy?: StrategyTag;
  /** Filter by side. */
  side?: TradeSide;
  /** Filter by status. */
  status?: TradeStatus;
  /** Filter by outcome (closed trades only). */
  outcome?: TradeOutcome;
  /** Filter by symbol (exact match). */
  symbol?: string;
  /** Minimum absolute P&L %. */
  minPnlPct?: number;
  /** Maximum absolute P&L %. */
  maxPnlPct?: number;
  /** Only show verified trades. */
  verifiedOnly?: boolean;
  /** Sort order. Default: "newest". */
  sort?: "newest" | "oldest" | "biggest_win" | "biggest_loss" | "most_discussed";
  /** Pagination. */
  limit?: number;
  offset?: number;
}

/**
 * A saved filter configuration. Users can save and name their filter combos.
 */
export interface SavedView {
  id: string;
  traderId: string;              // The user who saved this view
  name: string;                  // "My swing crypto winners", "Follow feed shorts"
  query: FeedQuery;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Trader Profile — Full View
// ─────────────────────────────────────────────

/**
 * Complete profile page data — assembled from multiple tables.
 * This is a read model, not stored directly.
 */
export interface TraderProfileView {
  trader: TraderPublicProfile;

  // Stats for the hero section (default: all-time, all assets, both sides)
  stats: TraderStats;

  // Breakdowns for the analytics tabs
  statsByAssetClass: Record<AssetClass, TraderStats | null>;
  statsBySide: Record<TradeSide, TraderStats | null>;
  statsByStrategy: Record<StrategyTag, TraderStats | null>;

  // Heatmaps and distributions
  instrumentHeatmap: InstrumentHeatmapEntry[];
  holdTimeDistribution: HoldTimeBucket[];
  hourOfDayHeatmap: HourOfDayEntry[];
  dayOfWeekHeatmap: DayOfWeekEntry[];

  // Recent activity
  recentTrades: SocialTrade[];   // Last 20 trades
  openPositions: SocialTrade[];  // Current open trades

  // Social
  isFollowedByViewer: boolean;   // For the Follow/Unfollow button
  topFollowers: TraderPublicProfile[]; // Top 5 followers by their own rank
}

/**
 * How a trader performs per instrument — rendered as a heatmap or treemap.
 */
export interface InstrumentHeatmapEntry {
  symbol: string;
  tradeCount: number;
  winRate: number;
  totalPnlPct: number;
  avgPnlPct: number;
}

/**
 * Distribution of hold times — rendered as a histogram.
 */
export interface HoldTimeBucket {
  label: string;                 // "<1h", "1-4h", "4-8h", "1d", "2-3d", "1w", "1w+"
  count: number;
  winRate: number;
  avgPnlPct: number;
}

/**
 * Performance by hour of trade entry — rendered as a 24-cell heatmap.
 */
export interface HourOfDayEntry {
  hour: number;                  // 0-23
  tradeCount: number;
  winRate: number;
  avgPnlPct: number;
}

/**
 * Performance by day of week — rendered as a 7-cell heatmap.
 */
export interface DayOfWeekEntry {
  day: number;                   // 0=Sunday, 6=Saturday
  dayLabel: string;              // "Mon", "Tue", etc.
  tradeCount: number;
  winRate: number;
  avgPnlPct: number;
}
