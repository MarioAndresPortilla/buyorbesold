import type { JournalStats, Trade, TradeOutcome, TradeStatus } from "./types";

/**
 * Pure functions for deriving trade state from stored fields.
 * Keep the storage shape minimal — compute status/PnL/R at read time so
 * corrections (e.g. fixing an entry price typo) propagate automatically.
 */

export function computeTradeDerived(trade: Trade): Trade {
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
  if (typeof trade.stop === "number" && trade.stop !== trade.entryPrice) {
    const riskPerShare = Math.abs(trade.entryPrice - trade.stop);
    if (riskPerShare > 0) {
      rMultiple = priceDelta / riskPerShare;
    }
  }

  return {
    ...trade,
    status,
    outcome,
    pnl,
    pnlPct,
    rMultiple,
  };
}

export function computeStats(trades: Trade[]): JournalStats {
  const withDerived = trades.map(computeTradeDerived);
  const closed = withDerived.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => t.outcome === "win");
  const losses = closed.filter((t) => t.outcome === "loss");
  const breakeven = closed.filter((t) => t.outcome === "breakeven");

  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const totalCost = closed.reduce(
    (sum, t) => sum + t.entryPrice * t.size,
    0
  );
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const avgWin =
    wins.length > 0
      ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length
      : 0;
  const avgLoss =
    losses.length > 0
      ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length
      : 0;
  const expectancy = closed.length > 0 ? totalPnl / closed.length : 0;

  const rValues = closed
    .map((t) => t.rMultiple)
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r));
  const avgRMultiple =
    rValues.length > 0
      ? rValues.reduce((a, b) => a + b, 0) / rValues.length
      : undefined;

  const bestTrade =
    closed.length > 0
      ? [...closed].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))[0]
      : undefined;
  const worstTrade =
    closed.length > 0
      ? [...closed].sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0))[0]
      : undefined;

  return {
    totalTrades: withDerived.length,
    openTrades: withDerived.filter((t) => t.status === "open").length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
    totalPnl,
    totalPnlPct,
    avgWin,
    avgLoss,
    expectancy,
    avgRMultiple,
    bestTrade,
    worstTrade,
  };
}

/**
 * Top 3 best and worst trades of a given day (closed trades only).
 * Matches Mario's "top 3 best / top 3 worst of the day" interpretation.
 */
export function getDailyTopMovers(
  trades: Trade[],
  date: string = new Date().toISOString().slice(0, 10)
): { best: Trade[]; worst: Trade[] } {
  const withDerived = trades.map(computeTradeDerived);
  const todayClosed = withDerived.filter(
    (t) => t.status === "closed" && t.exitDate?.slice(0, 10) === date
  );
  const byPnl = [...todayClosed].sort(
    (a, b) => (b.pnl ?? 0) - (a.pnl ?? 0)
  );
  return {
    best: byPnl.slice(0, 3),
    worst: byPnl.slice(-3).reverse(),
  };
}

export function newTradeId(): string {
  // ulid-ish: timestamp + random. Sortable by time, unique enough for a journal.
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

export const SETUP_TYPE_LABELS: Record<string, string> = {
  "sma-bounce": "SMA bounce",
  breakout: "Breakout",
  catalyst: "Catalyst / PR",
  reversal: "Reversal",
  other: "Other",
};
