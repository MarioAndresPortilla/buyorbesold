/**
 * Social Trading — Stats & Ranking Engine
 * ========================================
 *
 * Pure functions for computing TraderStats from an array of SocialTrades.
 * No side effects, no I/O — feed in trades, get stats out.
 *
 * These run:
 *   1. On trade close → update that trader's stats (incremental)
 *   2. Hourly cron   → rebuild all leaderboard snapshots
 *   3. On profile view → fresh stats if cache expired
 */

import type {
  AssetClass,
  DayOfWeekEntry,
  EquityCurvePoint,
  HoldTimeBucket,
  HourOfDayEntry,
  InstrumentHeatmapEntry,
  RankEntry,
  RankPeriod,
  RankQuery,
  RankSortKey,
  RANK_MIN_TRADES,
  SocialTrade,
  StrategyTag,
  TradeOutcome,
  TradeSide,
  TradeStatus,
  TraderStats,
} from "./social-trading-types";

// ─────────────────────────────────────────────
// Trade Derivation (mirrors existing journal.ts pattern)
// ─────────────────────────────────────────────

export function deriveTrade(trade: SocialTrade): SocialTrade {
  const status: TradeStatus =
    trade.exitDate && typeof trade.exitPrice === "number" ? "closed" : "open";

  if (status === "open") {
    return { ...trade, status };
  }

  const direction = trade.side === "long" ? 1 : -1;
  const priceDelta = (trade.exitPrice! - trade.entryPrice) * direction;
  const pnl = priceDelta * trade.size;
  const pnlPct = trade.entryPrice
    ? (priceDelta / trade.entryPrice) * 100
    : 0;

  let outcome: TradeOutcome;
  if (pnl > 0) outcome = "win";
  else if (pnl < 0) outcome = "loss";
  else outcome = "breakeven";

  let rMultiple: number | undefined;
  if (typeof trade.stopPrice === "number" && trade.stopPrice !== trade.entryPrice) {
    const riskPerShare = Math.abs(trade.entryPrice - trade.stopPrice);
    if (riskPerShare > 0) {
      rMultiple = priceDelta / riskPerShare;
    }
  }

  const entryMs = new Date(trade.entryDate).getTime();
  const exitMs = new Date(trade.exitDate!).getTime();
  const holdDurationMs = exitMs - entryMs;

  return {
    ...trade,
    status,
    outcome,
    pnl,
    pnlPct,
    rMultiple,
    holdDurationMs,
    holdDurationLabel: formatDuration(holdDurationMs),
  };
}

// ─────────────────────────────────────────────
// Wilson Score (anti-gaming)
// ─────────────────────────────────────────────

/**
 * Wilson score lower bound at 95% confidence.
 *
 * This is the key anti-gaming metric. Instead of ranking by raw win rate
 * (which rewards taking 3 trades and winning all 3), Wilson score rewards
 * BOTH high win rate AND large sample size.
 *
 * Examples:
 *   5 wins / 5 trades  → raw 100%, Wilson ~56%
 *   50 wins / 60 trades → raw 83%, Wilson ~72%
 *   500 wins / 600 trades → raw 83%, Wilson ~80%
 *
 * The more trades you take, the closer Wilson approaches your true win rate.
 */
export function wilsonScore(wins: number, total: number): number {
  if (total === 0) return 0;

  const z = 1.96; // 95% confidence
  const p = wins / total;
  const z2 = z * z;

  const numerator = p + z2 / (2 * total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  const denominator = 1 + z2 / total;

  return Math.max(0, (numerator / denominator) * 100);
}

// ─────────────────────────────────────────────
// Core Stats Computation
// ─────────────────────────────────────────────

export function computeTraderStats(
  traderId: string,
  rawTrades: SocialTrade[],
  period: RankPeriod,
  assetClass: AssetClass | "all",
  side: TradeSide | "both"
): TraderStats {
  const now = new Date();

  // Filter trades to matching dimensions
  let trades = rawTrades.map(deriveTrade);

  if (assetClass !== "all") {
    trades = trades.filter((t) => t.assetClass === assetClass);
  }
  if (side !== "both") {
    trades = trades.filter((t) => t.side === side);
  }

  // Period filter — apply to exit date for closed, entry date for open
  const periodStart = getPeriodStart(period, now);
  if (periodStart) {
    const startIso = periodStart.toISOString();
    trades = trades.filter((t) => {
      const relevantDate = t.status === "closed" ? t.exitDate! : t.entryDate;
      return relevantDate >= startIso;
    });
  }

  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");
  const wins = closed.filter((t) => t.outcome === "win");
  const losses = closed.filter((t) => t.outcome === "loss");
  const breakevenTrades = closed.filter((t) => t.outcome === "breakeven");

  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const winRateWilson = wilsonScore(wins.length, closed.length);

  // PnL
  const returnsPct = closed.map((t) => t.pnlPct ?? 0);
  const totalPnlPct = returnsPct.reduce((a, b) => a + b, 0);
  const winReturns = wins.map((t) => t.pnlPct ?? 0);
  const lossReturns = losses.map((t) => t.pnlPct ?? 0);
  const avgWinPct = winReturns.length > 0
    ? winReturns.reduce((a, b) => a + b, 0) / winReturns.length
    : 0;
  const avgLossPct = lossReturns.length > 0
    ? lossReturns.reduce((a, b) => a + b, 0) / lossReturns.length
    : 0;

  // Profit factor
  const grossWins = winReturns.reduce((a, b) => a + b, 0);
  const grossLosses = Math.abs(lossReturns.reduce((a, b) => a + b, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : null;

  // Expectancy
  const expectancy = closed.length > 0 ? totalPnlPct / closed.length : 0;

  // R-multiple
  const rValues = closed
    .map((t) => t.rMultiple)
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r));
  const avgRMultiple = rValues.length > 0
    ? rValues.reduce((a, b) => a + b, 0) / rValues.length
    : null;

  // Sharpe & Sortino
  const sharpe = computeSharpe(returnsPct);
  const sortino = computeSortino(returnsPct);

  // Max drawdown
  const maxDrawdownPct = computeMaxDrawdown(closed);

  // Max losing streak
  const maxLosingStreak = computeMaxLosingStreak(closed);

  // Hold duration
  const holdDurations = closed
    .map((t) => t.holdDurationMs)
    .filter((d): d is number => typeof d === "number");
  const avgHoldDurationMs = holdDurations.length > 0
    ? holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length
    : 0;

  // Best / worst
  const sortedByPnlPct = [...closed].sort(
    (a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0)
  );
  const bestTrade = sortedByPnlPct[0];
  const worstTrade = sortedByPnlPct[sortedByPnlPct.length - 1];

  // Equity curve
  const equityCurve = buildEquityCurve(closed);

  return {
    traderId,
    period,
    assetClass,
    side,
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: open.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakevenTrades.length,
    winRate,
    winRateWilson,
    totalPnlPct,
    avgWinPct,
    avgLossPct,
    profitFactor,
    expectancy,
    avgRMultiple,
    sharpe,
    sortino,
    maxDrawdownPct,
    maxLosingStreak,
    avgHoldDurationMs,
    avgHoldDurationLabel: formatDuration(avgHoldDurationMs),
    bestTradePnlPct: bestTrade?.pnlPct ?? 0,
    worstTradePnlPct: worstTrade?.pnlPct ?? 0,
    bestTradeId: bestTrade?.id,
    worstTradeId: worstTrade?.id,
    equityCurve,
    computedAt: now.toISOString(),
  };
}

// ─────────────────────────────────────────────
// Sharpe & Sortino
// ─────────────────────────────────────────────

/**
 * Annualized Sharpe ratio from per-trade returns.
 * Assumes ~252 trading days/year for annualization.
 * Returns null if fewer than 5 trades (not meaningful).
 */
function computeSharpe(returnsPct: number[]): number | null {
  if (returnsPct.length < 5) return null;

  const mean = returnsPct.reduce((a, b) => a + b, 0) / returnsPct.length;
  const variance =
    returnsPct.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (returnsPct.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return null;

  // Annualize: multiply by sqrt(trades per year estimate)
  // Conservative: assume 1 trade/day average
  const tradesPerYear = Math.min(returnsPct.length * (252 / returnsPct.length), 252);
  const annualizationFactor = Math.sqrt(tradesPerYear);

  return (mean / stdDev) * annualizationFactor;
}

/**
 * Sortino ratio — only penalizes downside deviation.
 * Better than Sharpe for traders with positively skewed returns.
 */
function computeSortino(returnsPct: number[]): number | null {
  if (returnsPct.length < 5) return null;

  const mean = returnsPct.reduce((a, b) => a + b, 0) / returnsPct.length;
  const downsideReturns = returnsPct.filter((r) => r < 0);

  if (downsideReturns.length === 0) return null; // No downside = infinite Sortino

  const downsideVariance =
    downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / downsideReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);

  if (downsideDev === 0) return null;

  const tradesPerYear = Math.min(returnsPct.length * (252 / returnsPct.length), 252);
  return (mean / downsideDev) * Math.sqrt(tradesPerYear);
}

// ─────────────────────────────────────────────
// Max Drawdown
// ─────────────────────────────────────────────

/**
 * Maximum peak-to-trough drawdown in cumulative % return.
 * Sorts trades by exit date, walks the equity curve, tracks
 * the worst dip from any prior peak.
 */
function computeMaxDrawdown(closedTrades: SocialTrade[]): number {
  if (closedTrades.length === 0) return 0;

  const sorted = [...closedTrades].sort(
    (a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime()
  );

  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;

  for (const trade of sorted) {
    cumulative += trade.pnlPct ?? 0;
    if (cumulative > peak) peak = cumulative;
    const dd = cumulative - peak;
    if (dd < maxDD) maxDD = dd;
  }

  return maxDD; // Negative number (e.g., -14.2)
}

// ─────────────────────────────────────────────
// Max Losing Streak
// ─────────────────────────────────────────────

function computeMaxLosingStreak(closedTrades: SocialTrade[]): number {
  const sorted = [...closedTrades].sort(
    (a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime()
  );

  let maxStreak = 0;
  let currentStreak = 0;

  for (const trade of sorted) {
    if (trade.outcome === "loss") {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  return maxStreak;
}

// ─────────────────────────────────────────────
// Equity Curve
// ─────────────────────────────────────────────

function buildEquityCurve(closedTrades: SocialTrade[]): EquityCurvePoint[] {
  if (closedTrades.length === 0) return [];

  const sorted = [...closedTrades].sort(
    (a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime()
  );

  let cumulative = 0;
  const points: EquityCurvePoint[] = [];

  // Group by date to avoid a point per trade (noisy for active traders)
  const byDate = new Map<string, { pnlPct: number; count: number }>();
  for (const trade of sorted) {
    const date = trade.exitDate!.slice(0, 10);
    const existing = byDate.get(date);
    if (existing) {
      existing.pnlPct += trade.pnlPct ?? 0;
      existing.count++;
    } else {
      byDate.set(date, { pnlPct: trade.pnlPct ?? 0, count: 1 });
    }
  }

  let runningCount = 0;
  for (const [date, { pnlPct, count }] of Array.from(byDate.entries())) {
    cumulative += pnlPct;
    runningCount += count;
    points.push({
      date,
      cumulativePnlPct: Math.round(cumulative * 100) / 100,
      tradeCount: runningCount,
    });
  }

  return points;
}

// ─────────────────────────────────────────────
// Leaderboard Builder
// ─────────────────────────────────────────────

/**
 * Given pre-computed stats for all traders, build a sorted leaderboard.
 * This runs hourly and the result is cached in KV as a sorted set.
 */
export function buildLeaderboard(
  allStats: TraderStats[],
  traders: Map<string, { username: string; displayName: string; avatarUrl?: string; verification: string }>,
  query: RankQuery,
  minTrades: Record<RankPeriod, number>
): RankEntry[] {
  const {
    period,
    assetClass = "all",
    side = "both",
    sortBy = "sharpe",
    verifiedOnly = true,
    limit = 50,
    offset = 0,
  } = query;

  // Filter to matching dimension
  let candidates = allStats.filter(
    (s) =>
      s.period === period &&
      s.assetClass === assetClass &&
      s.side === side
  );

  // Minimum trade threshold
  const minCount = minTrades[period];
  candidates = candidates.filter((s) => s.closedTrades >= minCount);

  // Verified only
  if (verifiedOnly) {
    candidates = candidates.filter((s) => {
      const trader = traders.get(s.traderId);
      return trader && trader.verification !== "self-reported";
    });
  }

  // Sort
  candidates.sort((a, b) => {
    const aVal = getSortValue(a, sortBy);
    const bVal = getSortValue(b, sortBy);
    return bVal - aVal; // Descending
  });

  // Paginate
  const page = candidates.slice(offset, offset + limit);

  return page.map((stats, i) => {
    const trader = traders.get(stats.traderId)!;
    return {
      rank: offset + i + 1,
      traderId: stats.traderId,
      username: trader.username,
      displayName: trader.displayName,
      avatarUrl: trader.avatarUrl,
      verification: trader.verification as any,
      period,
      assetClass,
      side,
      sortedBy: sortBy,
      sortValue: getSortValue(stats, sortBy),
      winRate: stats.winRate,
      winRateWilson: stats.winRateWilson,
      closedTrades: stats.closedTrades,
      totalPnlPct: stats.totalPnlPct,
      profitFactor: stats.profitFactor,
      sharpe: stats.sharpe,
      maxDrawdownPct: stats.maxDrawdownPct,
      avgRMultiple: stats.avgRMultiple,
      equityCurve: stats.equityCurve,
      meetsMinTrades: stats.closedTrades >= minCount,
    };
  });
}

function getSortValue(stats: TraderStats, key: RankSortKey): number {
  switch (key) {
    case "sharpe":
      return stats.sharpe ?? -Infinity;
    case "profit_factor":
      return stats.profitFactor ?? -Infinity;
    case "total_pnl_pct":
      return stats.totalPnlPct;
    case "win_rate":
      // Use Wilson score, not raw win rate, for ranking
      return stats.winRateWilson;
    case "expectancy":
      return stats.expectancy;
    case "avg_r_multiple":
      return stats.avgRMultiple ?? -Infinity;
    default:
      return stats.sharpe ?? -Infinity;
  }
}

// ─────────────────────────────────────────────
// Profile Analytics Helpers
// ─────────────────────────────────────────────

export function buildInstrumentHeatmap(
  trades: SocialTrade[]
): InstrumentHeatmapEntry[] {
  const derived = trades.map(deriveTrade);
  const closed = derived.filter((t) => t.status === "closed");
  const bySymbol = new Map<string, SocialTrade[]>();

  for (const trade of closed) {
    const existing = bySymbol.get(trade.symbol) ?? [];
    existing.push(trade);
    bySymbol.set(trade.symbol, existing);
  }

  return Array.from(bySymbol.entries())
    .map(([symbol, symbolTrades]) => {
      const wins = symbolTrades.filter((t) => t.outcome === "win").length;
      const totalPnlPct = symbolTrades.reduce((s, t) => s + (t.pnlPct ?? 0), 0);
      return {
        symbol,
        tradeCount: symbolTrades.length,
        winRate: symbolTrades.length > 0 ? (wins / symbolTrades.length) * 100 : 0,
        totalPnlPct,
        avgPnlPct: symbolTrades.length > 0 ? totalPnlPct / symbolTrades.length : 0,
      };
    })
    .sort((a, b) => b.tradeCount - a.tradeCount);
}

export function buildHoldTimeDistribution(
  trades: SocialTrade[]
): HoldTimeBucket[] {
  const derived = trades.map(deriveTrade);
  const closed = derived.filter(
    (t) => t.status === "closed" && typeof t.holdDurationMs === "number"
  );

  const buckets: { label: string; maxMs: number; trades: SocialTrade[] }[] = [
    { label: "<1h", maxMs: 3600_000, trades: [] },
    { label: "1-4h", maxMs: 14400_000, trades: [] },
    { label: "4-8h", maxMs: 28800_000, trades: [] },
    { label: "1d", maxMs: 86400_000, trades: [] },
    { label: "2-3d", maxMs: 259200_000, trades: [] },
    { label: "1w", maxMs: 604800_000, trades: [] },
    { label: "1w+", maxMs: Infinity, trades: [] },
  ];

  for (const trade of closed) {
    const duration = trade.holdDurationMs!;
    const bucket = buckets.find((b) => duration <= b.maxMs);
    if (bucket) bucket.trades.push(trade);
  }

  return buckets.map((b) => {
    const wins = b.trades.filter((t) => t.outcome === "win").length;
    const totalPnlPct = b.trades.reduce((s, t) => s + (t.pnlPct ?? 0), 0);
    return {
      label: b.label,
      count: b.trades.length,
      winRate: b.trades.length > 0 ? (wins / b.trades.length) * 100 : 0,
      avgPnlPct: b.trades.length > 0 ? totalPnlPct / b.trades.length : 0,
    };
  });
}

export function buildHourOfDayHeatmap(
  trades: SocialTrade[]
): HourOfDayEntry[] {
  const derived = trades.map(deriveTrade);
  const closed = derived.filter((t) => t.status === "closed");

  const hours: { trades: SocialTrade[] }[] = Array.from({ length: 24 }, () => ({
    trades: [],
  }));

  for (const trade of closed) {
    const hour = new Date(trade.entryDate).getUTCHours();
    hours[hour].trades.push(trade);
  }

  return hours.map((h, hour) => {
    const wins = h.trades.filter((t) => t.outcome === "win").length;
    const totalPnlPct = h.trades.reduce((s, t) => s + (t.pnlPct ?? 0), 0);
    return {
      hour,
      tradeCount: h.trades.length,
      winRate: h.trades.length > 0 ? (wins / h.trades.length) * 100 : 0,
      avgPnlPct: h.trades.length > 0 ? totalPnlPct / h.trades.length : 0,
    };
  });
}

export function buildDayOfWeekHeatmap(
  trades: SocialTrade[]
): DayOfWeekEntry[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const derived = trades.map(deriveTrade);
  const closed = derived.filter((t) => t.status === "closed");

  const days: { trades: SocialTrade[] }[] = Array.from({ length: 7 }, () => ({
    trades: [],
  }));

  for (const trade of closed) {
    const day = new Date(trade.entryDate).getUTCDay();
    days[day].trades.push(trade);
  }

  return days.map((d, day) => {
    const wins = d.trades.filter((t) => t.outcome === "win").length;
    const totalPnlPct = d.trades.reduce((s, t) => s + (t.pnlPct ?? 0), 0);
    return {
      day,
      dayLabel: labels[day],
      tradeCount: d.trades.length,
      winRate: d.trades.length > 0 ? (wins / d.trades.length) * 100 : 0,
      avgPnlPct: d.trades.length > 0 ? totalPnlPct / d.trades.length : 0,
    };
  });
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) {
    const remainDays = days % 7;
    return remainDays > 0 ? `${weeks}w ${remainDays}d` : `${weeks}w`;
  }
  if (days > 0) {
    const remainHours = hours % 24;
    return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const remainMinutes = minutes % 60;
    return remainMinutes > 0 ? `${hours}h ${remainMinutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function getPeriodStart(period: RankPeriod, now: Date): Date | null {
  switch (period) {
    case "1d": {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 1);
      return d;
    }
    case "1w": {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 7);
      return d;
    }
    case "1m": {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d;
    }
    case "3m": {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - 3);
      return d;
    }
    case "ytd": {
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    }
    case "1y": {
      const d = new Date(now);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      return d;
    }
    case "all":
      return null; // No filter
    default:
      return null;
  }
}
