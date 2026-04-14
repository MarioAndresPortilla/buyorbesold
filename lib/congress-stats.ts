/**
 * Congress stats engine.
 *
 * For each member × period, computes:
 *   - total_trades, buy/sell split, unique symbols, $ volume (midpoints)
 *   - timing_alpha_{30,90}d_pct:
 *       avg forward return on buys + inverted forward return on sells,
 *       minus SPY's return over the same window.
 *       (A member who buys stocks that outperform SPY 30 days later
 *        has positive alpha; a member who sells stocks that drop vs
 *        SPY has positive alpha too.)
 *   - win_rate_30d: % of trades where the 30d move went the member's way
 *   - top_symbol: name with most trades in the window
 *   - qualifies: has enough trades to appear on the leaderboard
 *
 * Only considers trades with a computable forward return (skips trades
 * too recent for the hold window to have elapsed yet).
 */

import { query } from "./db";
import { forwardReturnPct } from "./congress-prices";
import {
  CONGRESS_RANK_MIN_TRADES,
  type CongressMemberStats,
  type CongressStatPeriod,
  type CongressTradeType,
} from "./congress-types";

interface TradeRow {
  symbol: string;
  transaction_type: CongressTradeType;
  transaction_date: string; // YYYY-MM-DD (cast ::text in SELECT)
  amount_mid: string | number | null;
}

const SPY = "SPY";
const HOLD_WINDOW_DAYS = [30, 90] as const;

/**
 * Filter window per period. "all" has no lower bound.
 * Returns YYYY-MM-DD.
 */
function periodStartDate(period: CongressStatPeriod): string | null {
  const now = new Date();
  const d = new Date(now);
  switch (period) {
    case "1m":
      d.setMonth(d.getMonth() - 1);
      break;
    case "3m":
      d.setMonth(d.getMonth() - 3);
      break;
    case "ytd":
      d.setMonth(0, 1); // Jan 1 of current year
      break;
    case "1y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    case "all":
      return null;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch all trades for a member within a period, with forward-return
 * elapsed enough that 30d and 90d can be computed (i.e., txn_date <=
 * today - 30d for 30d alpha, today - 90d for 90d alpha).
 *
 * We fetch a superset (trades up to today) and filter per-metric later.
 */
async function fetchMemberTradesInPeriod(
  memberId: string,
  period: CongressStatPeriod,
): Promise<TradeRow[]> {
  const startDate = periodStartDate(period);
  if (startDate) {
    return await query<TradeRow>`
      SELECT symbol, transaction_type,
             transaction_date::text AS transaction_date,
             amount_mid
      FROM congress_trades
      WHERE member_id = ${memberId}
        AND transaction_date >= ${startDate}::date
      ORDER BY transaction_date DESC
    `;
  }
  return await query<TradeRow>`
    SELECT symbol, transaction_type,
           transaction_date::text AS transaction_date,
           amount_mid
    FROM congress_trades
    WHERE member_id = ${memberId}
    ORDER BY transaction_date DESC
  `;
}

function daysAgo(date: string): number {
  const then = new Date(date + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

/**
 * Compute stats for one member × one period. Returns a row ready to
 * upsert into congress_member_stats.
 */
export async function computeMemberStats(
  memberId: string,
  period: CongressStatPeriod,
): Promise<CongressMemberStats> {
  const trades = await fetchMemberTradesInPeriod(memberId, period);

  // Totals
  let buyCount = 0;
  let sellCount = 0;
  let estVolumeUsd = 0;
  const symbolCounts = new Map<string, number>();

  for (const t of trades) {
    if (t.transaction_type === "buy") buyCount++;
    else if (t.transaction_type === "sell") sellCount++;
    if (t.amount_mid != null) estVolumeUsd += Number(t.amount_mid);
    symbolCounts.set(t.symbol, (symbolCounts.get(t.symbol) ?? 0) + 1);
  }

  const uniqueSymbols = symbolCounts.size;
  let topSymbol: string | undefined;
  let topSymbolTrades = 0;
  for (const [sym, n] of symbolCounts) {
    if (n > topSymbolTrades) {
      topSymbol = sym;
      topSymbolTrades = n;
    }
  }

  // Timing alpha — only for trades where the forward window has elapsed
  // and the type is directional (buy/sell, skip exchange/other).
  const alpha30 = await computeAlpha(trades, 30);
  const alpha90 = await computeAlpha(trades, 90);

  // Qualify flag — enough trades to rank
  const minTrades = CONGRESS_RANK_MIN_TRADES[period];
  const directionalTrades = buyCount + sellCount;
  const qualifies = directionalTrades >= minTrades && alpha30.count >= minTrades;

  return {
    memberId,
    period,
    totalTrades: trades.length,
    buyCount,
    sellCount,
    uniqueSymbols,
    estVolumeUsd,
    timingAlpha30dPct: alpha30.alpha,
    timingAlpha90dPct: alpha90.alpha,
    winRate30d: alpha30.winRate,
    avgForwardReturn30dPct: alpha30.avgMemberReturn,
    topSymbol,
    topSymbolTrades: topSymbol ? topSymbolTrades : undefined,
    qualifies,
    computedAt: new Date().toISOString(),
  };
}

interface AlphaResult {
  alpha: number | null;
  avgMemberReturn: number | null;
  winRate: number | null;
  count: number;
}

/**
 * For each directional trade where `holdDays` has elapsed, compute:
 *   member return = buy: +forwardReturn, sell: -forwardReturn
 *   alpha = member return - SPY forward return over same window
 * Average across trades. Also count "wins" (alpha > 0).
 */
async function computeAlpha(trades: TradeRow[], holdDays: number): Promise<AlphaResult> {
  let memberSum = 0;
  let alphaSum = 0;
  let wins = 0;
  let count = 0;

  for (const t of trades) {
    if (t.transaction_type !== "buy" && t.transaction_type !== "sell") continue;
    if (daysAgo(t.transaction_date) < holdDays + 2) continue; // +2 for weekend lag

    const [stockRet, spyRet] = await Promise.all([
      forwardReturnPct(t.symbol, t.transaction_date, holdDays),
      forwardReturnPct(SPY, t.transaction_date, holdDays),
    ]);
    if (stockRet == null || spyRet == null) continue;

    const memberReturn =
      t.transaction_type === "buy" ? stockRet : -stockRet;
    const alpha = memberReturn - (t.transaction_type === "buy" ? spyRet : -spyRet);

    memberSum += memberReturn;
    alphaSum += alpha;
    if (alpha > 0) wins++;
    count++;
  }

  if (count === 0) {
    return { alpha: null, avgMemberReturn: null, winRate: null, count: 0 };
  }
  return {
    alpha: alphaSum / count,
    avgMemberReturn: memberSum / count,
    winRate: (wins / count) * 100,
    count,
  };
}

/**
 * Upsert a computed stat row.
 */
export async function upsertMemberStats(s: CongressMemberStats): Promise<void> {
  await query`
    INSERT INTO congress_member_stats (
      member_id, period, total_trades, buy_count, sell_count,
      unique_symbols, est_volume_usd,
      timing_alpha_30d_pct, timing_alpha_90d_pct,
      win_rate_30d, avg_forward_return_30d_pct,
      top_symbol, top_symbol_trades, qualifies, computed_at
    ) VALUES (
      ${s.memberId}, ${s.period}, ${s.totalTrades}, ${s.buyCount}, ${s.sellCount},
      ${s.uniqueSymbols}, ${s.estVolumeUsd},
      ${s.timingAlpha30dPct}, ${s.timingAlpha90dPct},
      ${s.winRate30d}, ${s.avgForwardReturn30dPct},
      ${s.topSymbol ?? null}, ${s.topSymbolTrades ?? null},
      ${s.qualifies}, ${s.computedAt}
    )
    ON CONFLICT (member_id, period)
    DO UPDATE SET
      total_trades = EXCLUDED.total_trades,
      buy_count = EXCLUDED.buy_count,
      sell_count = EXCLUDED.sell_count,
      unique_symbols = EXCLUDED.unique_symbols,
      est_volume_usd = EXCLUDED.est_volume_usd,
      timing_alpha_30d_pct = EXCLUDED.timing_alpha_30d_pct,
      timing_alpha_90d_pct = EXCLUDED.timing_alpha_90d_pct,
      win_rate_30d = EXCLUDED.win_rate_30d,
      avg_forward_return_30d_pct = EXCLUDED.avg_forward_return_30d_pct,
      top_symbol = EXCLUDED.top_symbol,
      top_symbol_trades = EXCLUDED.top_symbol_trades,
      qualifies = EXCLUDED.qualifies,
      computed_at = EXCLUDED.computed_at
  `;
}

export const CONGRESS_STAT_NUMERIC_FIELDS = [
  "est_volume_usd",
  "timing_alpha_30d_pct",
  "timing_alpha_90d_pct",
  "win_rate_30d",
  "avg_forward_return_30d_pct",
] as const;
