/**
 * Read-side query helpers for the Congress monitor.
 * UI routes and the chatbot both call through here so query shapes stay
 * in one place.
 */

import { coerceNums, query, toNum } from "./db";
import {
  type CongressLeaderEntry,
  type CongressMember,
  type CongressMemberStats,
  type CongressProfileView,
  type CongressStatPeriod,
  type CongressTrade,
  type CongressTradeType,
  type CongressChamber,
  type CongressParty,
} from "./congress-types";
import { CONGRESS_STAT_NUMERIC_FIELDS } from "./congress-stats";

interface MemberRow {
  id: string;
  raw_name: string;
  display_name: string;
  chamber: CongressChamber;
  party: CongressParty;
  state: string | null;
  photo_url: string | null;
  total_trades: number;
  last_traded_at: string | null;
  first_seen_at: string;
  created_at: string;
  updated_at: string;
}

function mapMember(r: MemberRow): CongressMember {
  return {
    id: r.id,
    rawName: r.raw_name,
    displayName: r.display_name,
    chamber: r.chamber,
    party: r.party,
    state: r.state ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    totalTrades: r.total_trades,
    lastTradedAt: r.last_traded_at ?? undefined,
    firstSeenAt: r.first_seen_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface StatsRow {
  member_id: string;
  period: CongressStatPeriod;
  total_trades: number;
  buy_count: number;
  sell_count: number;
  unique_symbols: number;
  est_volume_usd: string | number;
  timing_alpha_30d_pct: string | number | null;
  timing_alpha_90d_pct: string | number | null;
  win_rate_30d: string | number | null;
  avg_forward_return_30d_pct: string | number | null;
  top_symbol: string | null;
  top_symbol_trades: number | null;
  qualifies: boolean;
  computed_at: string;
}

function mapStats(r: StatsRow): CongressMemberStats {
  const n = coerceNums(r as unknown as Record<string, unknown>, CONGRESS_STAT_NUMERIC_FIELDS);
  return {
    memberId: r.member_id,
    period: r.period,
    totalTrades: r.total_trades,
    buyCount: r.buy_count,
    sellCount: r.sell_count,
    uniqueSymbols: r.unique_symbols,
    estVolumeUsd: Number(n.est_volume_usd) || 0,
    timingAlpha30dPct: toNum(n.timing_alpha_30d_pct),
    timingAlpha90dPct: toNum(n.timing_alpha_90d_pct),
    winRate30d: toNum(n.win_rate_30d),
    avgForwardReturn30dPct: toNum(n.avg_forward_return_30d_pct),
    topSymbol: r.top_symbol ?? undefined,
    topSymbolTrades: r.top_symbol_trades ?? undefined,
    qualifies: r.qualifies,
    computedAt: r.computed_at,
  };
}

interface TradeRow {
  id: string;
  member_id: string;
  symbol: string;
  asset_name: string | null;
  transaction_type: CongressTradeType;
  transaction_date: string;
  filing_date: string | null;
  amount_low: string | number | null;
  amount_high: string | number | null;
  amount_mid: string | number | null;
  owner_type: string | null;
  position: string | null;
  source: string;
  filing_id: string | null;
  created_at: string;
}

function mapTrade(r: TradeRow): CongressTrade {
  return {
    id: r.id,
    memberId: r.member_id,
    symbol: r.symbol,
    assetName: r.asset_name ?? undefined,
    transactionType: r.transaction_type,
    transactionDate: r.transaction_date,
    filingDate: r.filing_date ?? undefined,
    amountLow: toNum(r.amount_low) ?? undefined,
    amountHigh: toNum(r.amount_high) ?? undefined,
    amountMid: toNum(r.amount_mid) ?? undefined,
    ownerType: r.owner_type ?? undefined,
    position: r.position ?? undefined,
    source: r.source,
    filingId: r.filing_id ?? undefined,
    createdAt: r.created_at,
  };
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

export type CongressRankMetric =
  | "timing_alpha_30d"
  | "timing_alpha_90d"
  | "total_trades"
  | "est_volume_usd"
  | "win_rate_30d";

export interface LeaderboardQuery {
  period: CongressStatPeriod;
  metric: CongressRankMetric;
  limit: number;
  qualifyingOnly?: boolean;
}

/**
 * Return a ranked leaderboard for the given period + metric.
 */
export async function getLeaderboard(q: LeaderboardQuery): Promise<CongressLeaderEntry[]> {
  const qualifyingOnly = q.qualifyingOnly !== false;

  const rows = await query<MemberRow & StatsRow>`
    SELECT
      m.id, m.raw_name, m.display_name, m.chamber, m.party, m.state,
      m.photo_url, m.total_trades, m.last_traded_at::text AS last_traded_at,
      m.first_seen_at::text AS first_seen_at,
      m.created_at::text AS created_at, m.updated_at::text AS updated_at,
      s.member_id, s.period,
      s.total_trades AS stat_total_trades,
      s.buy_count, s.sell_count, s.unique_symbols, s.est_volume_usd,
      s.timing_alpha_30d_pct, s.timing_alpha_90d_pct,
      s.win_rate_30d, s.avg_forward_return_30d_pct,
      s.top_symbol, s.top_symbol_trades, s.qualifies,
      s.computed_at::text AS computed_at
    FROM congress_member_stats s
    JOIN congress_members m ON m.id = s.member_id
    WHERE s.period = ${q.period}
      AND (${!qualifyingOnly} OR s.qualifies = true)
    ORDER BY
      CASE WHEN ${q.metric} = 'timing_alpha_30d' THEN s.timing_alpha_30d_pct END DESC NULLS LAST,
      CASE WHEN ${q.metric} = 'timing_alpha_90d' THEN s.timing_alpha_90d_pct END DESC NULLS LAST,
      CASE WHEN ${q.metric} = 'total_trades' THEN s.total_trades END DESC,
      CASE WHEN ${q.metric} = 'est_volume_usd' THEN s.est_volume_usd END DESC,
      CASE WHEN ${q.metric} = 'win_rate_30d' THEN s.win_rate_30d END DESC NULLS LAST
    LIMIT ${q.limit}
  `;

  return rows.map((r, i) => {
    // Reconstruct member + stats from the joined row
    const member = mapMember({
      id: r.id,
      raw_name: r.raw_name,
      display_name: r.display_name,
      chamber: r.chamber,
      party: r.party,
      state: r.state,
      photo_url: r.photo_url,
      total_trades: r.total_trades,
      last_traded_at: r.last_traded_at,
      first_seen_at: r.first_seen_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
    // The joined stats row has stat_total_trades aliased; remap.
    const stats = mapStats({
      member_id: r.member_id,
      period: r.period,
      total_trades: (r as unknown as { stat_total_trades: number }).stat_total_trades,
      buy_count: r.buy_count,
      sell_count: r.sell_count,
      unique_symbols: r.unique_symbols,
      est_volume_usd: r.est_volume_usd,
      timing_alpha_30d_pct: r.timing_alpha_30d_pct,
      timing_alpha_90d_pct: r.timing_alpha_90d_pct,
      win_rate_30d: r.win_rate_30d,
      avg_forward_return_30d_pct: r.avg_forward_return_30d_pct,
      top_symbol: r.top_symbol,
      top_symbol_trades: r.top_symbol_trades,
      qualifies: r.qualifies,
      computed_at: r.computed_at,
    });
    return { rank: i + 1, member, stats };
  });
}

export async function getMemberBySlug(slug: string): Promise<CongressMember | null> {
  const rows = await query<MemberRow>`
    SELECT id, raw_name, display_name, chamber, party, state,
           photo_url, total_trades,
           last_traded_at::text AS last_traded_at,
           first_seen_at::text AS first_seen_at,
           created_at::text AS created_at,
           updated_at::text AS updated_at
    FROM congress_members WHERE id = ${slug}
  `;
  return rows[0] ? mapMember(rows[0]) : null;
}

export async function getMemberStats(memberId: string): Promise<Record<CongressStatPeriod, CongressMemberStats | null>> {
  const rows = await query<StatsRow>`
    SELECT member_id, period, total_trades, buy_count, sell_count,
           unique_symbols, est_volume_usd,
           timing_alpha_30d_pct, timing_alpha_90d_pct,
           win_rate_30d, avg_forward_return_30d_pct,
           top_symbol, top_symbol_trades, qualifies,
           computed_at::text AS computed_at
    FROM congress_member_stats WHERE member_id = ${memberId}
  `;
  const out: Record<CongressStatPeriod, CongressMemberStats | null> = {
    "1m": null, "3m": null, ytd: null, "1y": null, all: null,
  };
  for (const r of rows) out[r.period] = mapStats(r);
  return out;
}

export async function getMemberTrades(memberId: string, limit = 50): Promise<CongressTrade[]> {
  const rows = await query<TradeRow>`
    SELECT id, member_id, symbol, asset_name, transaction_type,
           transaction_date::text AS transaction_date,
           filing_date::text AS filing_date,
           amount_low, amount_high, amount_mid,
           owner_type, position, source, filing_id,
           created_at::text AS created_at
    FROM congress_trades
    WHERE member_id = ${memberId}
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapTrade);
}

export async function getMemberTopSymbols(memberId: string, limit = 10) {
  const rows = await query<{
    symbol: string;
    trade_count: number;
    buy_count: number;
    sell_count: number;
    est_volume_usd: string | number;
  }>`
    SELECT
      symbol,
      COUNT(*)::int AS trade_count,
      COUNT(*) FILTER (WHERE transaction_type = 'buy')::int AS buy_count,
      COUNT(*) FILTER (WHERE transaction_type = 'sell')::int AS sell_count,
      COALESCE(SUM(amount_mid), 0) AS est_volume_usd
    FROM congress_trades
    WHERE member_id = ${memberId}
    GROUP BY symbol
    ORDER BY trade_count DESC, est_volume_usd DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    symbol: r.symbol,
    tradeCount: r.trade_count,
    buyCount: r.buy_count,
    sellCount: r.sell_count,
    estVolumeUsd: Number(r.est_volume_usd) || 0,
  }));
}

export async function getMemberProfile(slug: string): Promise<CongressProfileView | null> {
  const member = await getMemberBySlug(slug);
  if (!member) return null;
  const [stats, recentTrades, topSymbols] = await Promise.all([
    getMemberStats(member.id),
    getMemberTrades(member.id, 50),
    getMemberTopSymbols(member.id, 10),
  ]);
  return { member, stats, recentTrades, topSymbols };
}

/**
 * Query trades across ALL members, with optional filters.
 * Used by the chatbot's get_congress_trades tool and the trade-feed UI.
 */
export interface CongressTradeFilter {
  memberId?: string;
  symbol?: string;
  transactionType?: CongressTradeType;
  since?: string; // YYYY-MM-DD
  limit?: number;
}

export async function queryCongressTrades(f: CongressTradeFilter) {
  const limit = Math.min(Math.max(f.limit ?? 100, 1), 500);
  const since = f.since ?? null;

  const rows = await query<TradeRow & { member_name: string }>`
    SELECT t.id, t.member_id, t.symbol, t.asset_name, t.transaction_type,
           t.transaction_date::text AS transaction_date,
           t.filing_date::text AS filing_date,
           t.amount_low, t.amount_high, t.amount_mid,
           t.owner_type, t.position, t.source, t.filing_id,
           t.created_at::text AS created_at,
           m.display_name AS member_name
    FROM congress_trades t
    JOIN congress_members m ON m.id = t.member_id
    WHERE
      (${f.memberId ?? null}::text IS NULL OR t.member_id = ${f.memberId ?? null})
      AND (${f.symbol ?? null}::text IS NULL OR t.symbol = ${f.symbol ?? null})
      AND (${f.transactionType ?? null}::text IS NULL OR t.transaction_type = ${f.transactionType ?? null})
      AND (${since}::date IS NULL OR t.transaction_date >= ${since}::date)
    ORDER BY t.transaction_date DESC, t.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ ...mapTrade(r), memberName: r.member_name }));
}
