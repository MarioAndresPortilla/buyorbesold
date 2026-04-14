import type { Trade } from "./types";
import { computeStats, computeTradeDerived, SETUP_TYPE_LABELS } from "./journal";

/**
 * Deep statistical analysis of a trader's journal. All derivations are pure
 * and deterministic — the chatbot consumes this object so its "insights" are
 * grounded in real numbers rather than hallucinated.
 *
 * Never import this from the client bundle; it's cheap but only the API
 * route needs it.
 */

export interface GroupStat {
  key: string;
  label: string;
  n: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgR?: number;
}

export interface DeepJournalStats {
  headline: {
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    winRate: number;
    expectancy: number;
    totalPnl: number;
    avgR?: number;
    profitFactor?: number;
    sharpeLike?: number;
  };
  streaks: {
    longestWin: number;
    longestLoss: number;
    currentStreak: number;
    currentStreakKind: "win" | "loss" | "none";
  };
  drawdown: {
    maxDrawdown: number;
    maxDrawdownPct: number;
    currentDrawdown: number;
  };
  holdTime: {
    avgHoldDays: number;
    intradayCount: number;
    swingCount: number;
    avgHoldWin: number;
    avgHoldLoss: number;
  };
  frequency: {
    tradesPerWeek: number;
    tradesPerMonth: number;
    activeWeeks: number;
  };
  bySetup: GroupStat[];
  bySide: GroupStat[];
  bySymbol: GroupStat[];
  byMonth: GroupStat[];
  byDayOfWeek: GroupStat[];
  byTag: GroupStat[];
  extremes: {
    best?: Trade;
    worst?: Trade;
    biggestR?: Trade;
    worstR?: Trade;
  };
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function groupBy<T>(items: T[], keyFn: (t: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (key === null) continue;
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

function groupStat(key: string, label: string, trades: Trade[]): GroupStat {
  const s = computeStats(trades);
  return {
    key,
    label,
    n: s.closedTrades,
    wins: s.wins,
    losses: s.losses,
    winRate: s.winRate,
    totalPnl: s.totalPnl,
    avgPnl: s.expectancy,
    avgR: s.avgRMultiple,
  };
}

function computeStreaks(closed: Trade[]): DeepJournalStats["streaks"] {
  // Sort by exitDate ascending (chronological).
  const sorted = [...closed].sort(
    (a, b) =>
      new Date(a.exitDate ?? a.entryDate).getTime() -
      new Date(b.exitDate ?? b.entryDate).getTime()
  );
  let longestWin = 0;
  let longestLoss = 0;
  let winRun = 0;
  let lossRun = 0;
  for (const t of sorted) {
    if (t.outcome === "win") {
      winRun++;
      lossRun = 0;
      longestWin = Math.max(longestWin, winRun);
    } else if (t.outcome === "loss") {
      lossRun++;
      winRun = 0;
      longestLoss = Math.max(longestLoss, lossRun);
    } else {
      winRun = 0;
      lossRun = 0;
    }
  }
  let currentStreak = 0;
  let currentStreakKind: "win" | "loss" | "none" = "none";
  for (let i = sorted.length - 1; i >= 0; i--) {
    const t = sorted[i];
    if (i === sorted.length - 1) {
      if (t.outcome === "win") currentStreakKind = "win";
      else if (t.outcome === "loss") currentStreakKind = "loss";
      else break;
      currentStreak = 1;
    } else {
      if (t.outcome === currentStreakKind) currentStreak++;
      else break;
    }
  }
  return { longestWin, longestLoss, currentStreak, currentStreakKind };
}

function computeDrawdown(closed: Trade[]): DeepJournalStats["drawdown"] {
  const sorted = [...closed].sort(
    (a, b) =>
      new Date(a.exitDate ?? a.entryDate).getTime() -
      new Date(b.exitDate ?? b.entryDate).getTime()
  );
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  let maxDdPct = 0;
  for (const t of sorted) {
    cum += t.pnl ?? 0;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }
  const currentDrawdown = peak - cum;
  return { maxDrawdown: maxDd, maxDrawdownPct: maxDdPct, currentDrawdown };
}

function computeHoldTime(closed: Trade[]): DeepJournalStats["holdTime"] {
  let totalDays = 0;
  let totalWinDays = 0;
  let totalLossDays = 0;
  let intraday = 0;
  let swing = 0;
  let winCount = 0;
  let lossCount = 0;
  for (const t of closed) {
    if (!t.exitDate) continue;
    const d =
      (new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) /
      (1000 * 60 * 60 * 24);
    totalDays += d;
    if (d < 1) intraday++;
    else swing++;
    if (t.outcome === "win") {
      totalWinDays += d;
      winCount++;
    } else if (t.outcome === "loss") {
      totalLossDays += d;
      lossCount++;
    }
  }
  return {
    avgHoldDays: closed.length > 0 ? totalDays / closed.length : 0,
    intradayCount: intraday,
    swingCount: swing,
    avgHoldWin: winCount > 0 ? totalWinDays / winCount : 0,
    avgHoldLoss: lossCount > 0 ? totalLossDays / lossCount : 0,
  };
}

function computeFrequency(all: Trade[]): DeepJournalStats["frequency"] {
  if (all.length === 0) {
    return { tradesPerWeek: 0, tradesPerMonth: 0, activeWeeks: 0 };
  }
  const dates = all.map((t) => new Date(t.entryDate).getTime());
  const first = Math.min(...dates);
  const last = Math.max(...dates);
  const spanDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
  const weeks = new Set<string>();
  for (const t of all) {
    const d = new Date(t.entryDate);
    const year = d.getUTCFullYear();
    const doy = Math.floor(
      (d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    weeks.add(`${year}-${Math.floor(doy / 7)}`);
  }
  return {
    tradesPerWeek: (all.length / spanDays) * 7,
    tradesPerMonth: (all.length / spanDays) * 30,
    activeWeeks: weeks.size,
  };
}

export function computeDeepStats(rawTrades: Trade[]): DeepJournalStats {
  const trades = rawTrades.map(computeTradeDerived);
  const headline = computeStats(rawTrades);
  const closed = trades.filter((t) => t.status === "closed");

  const grossWins = closed
    .filter((t) => (t.pnl ?? 0) > 0)
    .reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLosses = Math.abs(
    closed.filter((t) => (t.pnl ?? 0) < 0).reduce((s, t) => s + (t.pnl ?? 0), 0)
  );
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : undefined;

  // Sharpe-like: mean(pnlPct) / stdev(pnlPct). Not a true Sharpe (no risk-free
  // rate, no annualization) — just a risk-adjusted signal for the narrative.
  const pcts = closed
    .map((t) => t.pnlPct)
    .filter((p): p is number => typeof p === "number");
  let sharpeLike: number | undefined;
  if (pcts.length >= 2) {
    const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const variance =
      pcts.reduce((s, p) => s + (p - mean) ** 2, 0) / (pcts.length - 1);
    const stdev = Math.sqrt(variance);
    sharpeLike = stdev > 0 ? mean / stdev : undefined;
  }

  // Group by setup
  const setupMap = groupBy(closed, (t) => t.setupType);
  const bySetup: GroupStat[] = Array.from(setupMap.entries())
    .map(([k, arr]) => groupStat(k, SETUP_TYPE_LABELS[k] ?? k, arr))
    .sort((a, b) => b.totalPnl - a.totalPnl);

  // Group by side
  const sideMap = groupBy(closed, (t) => t.side);
  const bySide: GroupStat[] = Array.from(sideMap.entries())
    .map(([k, arr]) => groupStat(k, k === "long" ? "Long" : "Short", arr))
    .sort((a, b) => b.totalPnl - a.totalPnl);

  // Group by symbol — keep top 15 by abs pnl
  const symMap = groupBy(closed, (t) => t.symbol);
  const bySymbol: GroupStat[] = Array.from(symMap.entries())
    .map(([k, arr]) => groupStat(k, k, arr))
    .sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl))
    .slice(0, 15);

  // Group by month (YYYY-MM of exit date)
  const monthMap = groupBy(closed, (t) =>
    t.exitDate ? t.exitDate.slice(0, 7) : null
  );
  const byMonth: GroupStat[] = Array.from(monthMap.entries())
    .map(([k, arr]) => {
      const [y, m] = k.split("-");
      return groupStat(k, `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`, arr);
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  // Group by day of week
  const dowMap = groupBy(closed, (t) => {
    const d = new Date(t.entryDate);
    return String(d.getUTCDay());
  });
  const byDayOfWeek: GroupStat[] = Array.from(dowMap.entries())
    .map(([k, arr]) => groupStat(k, DOW_LABELS[parseInt(k, 10)] ?? k, arr))
    .sort((a, b) => parseInt(a.key, 10) - parseInt(b.key, 10));

  // Group by tag (a trade with multiple tags contributes to each)
  const tagMap = new Map<string, Trade[]>();
  for (const t of closed) {
    for (const tag of t.tags ?? []) {
      const arr = tagMap.get(tag) ?? [];
      arr.push(t);
      tagMap.set(tag, arr);
    }
  }
  const byTag: GroupStat[] = Array.from(tagMap.entries())
    .map(([k, arr]) => groupStat(k, k, arr))
    .sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl))
    .slice(0, 15);

  // Extremes
  const byR = [...closed].filter(
    (t) => typeof t.rMultiple === "number" && Number.isFinite(t.rMultiple)
  );
  const biggestR = byR.length > 0
    ? [...byR].sort((a, b) => (b.rMultiple ?? 0) - (a.rMultiple ?? 0))[0]
    : undefined;
  const worstR = byR.length > 0
    ? [...byR].sort((a, b) => (a.rMultiple ?? 0) - (b.rMultiple ?? 0))[0]
    : undefined;

  return {
    headline: {
      totalTrades: headline.totalTrades,
      openTrades: headline.openTrades,
      closedTrades: headline.closedTrades,
      winRate: headline.winRate,
      expectancy: headline.expectancy,
      totalPnl: headline.totalPnl,
      avgR: headline.avgRMultiple,
      profitFactor,
      sharpeLike,
    },
    streaks: computeStreaks(closed),
    drawdown: computeDrawdown(closed),
    holdTime: computeHoldTime(closed),
    frequency: computeFrequency(trades),
    bySetup,
    bySide,
    bySymbol,
    byMonth,
    byDayOfWeek,
    byTag,
    extremes: {
      best: headline.bestTrade,
      worst: headline.worstTrade,
      biggestR,
      worstR,
    },
  };
}
