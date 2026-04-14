/**
 * Congress Trade Monitor — Data Model
 * ===================================
 *
 * Tracks STOCK Act disclosures for members of Congress.
 * Ingested nightly from Finnhub (/stock/congressional-trading).
 * Backfill path is CapitolTrades scrape (future).
 *
 * All dates are "wall dates" — the STOCK Act discloses a date of
 * transaction, not a timestamp, so DATE (not TIMESTAMPTZ) is correct.
 */

// ─────────────────────────────────────────────
// Enums / Literals
// ─────────────────────────────────────────────

export type CongressChamber = "house" | "senate" | "unknown";
export type CongressParty = "D" | "R" | "I" | "unknown";
export type CongressTradeType = "buy" | "sell" | "exchange" | "other";
export type CongressStatPeriod = "1m" | "3m" | "ytd" | "1y" | "all";

// Minimum trade counts required to appear on a leaderboard.
// Short periods need fewer trades, long periods more — prevents a single
// lucky trade from dominating the "all-time" rankings.
export const CONGRESS_RANK_MIN_TRADES: Record<CongressStatPeriod, number> = {
  "1m": 3,
  "3m": 5,
  ytd: 8,
  "1y": 10,
  all: 15,
};

// ─────────────────────────────────────────────
// Core entities
// ─────────────────────────────────────────────

export interface CongressMember {
  /** URL-safe slug: "nancy-pelosi", "dan-crenshaw". Stable primary key. */
  id: string;
  /** Raw name as returned by the filing source — preserved for re-slugging. */
  rawName: string;
  displayName: string;
  chamber: CongressChamber;
  party: CongressParty;
  state?: string;
  photoUrl?: string;
  totalTrades: number;
  lastTradedAt?: string;
  firstSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CongressTrade {
  id: string;
  memberId: string;
  symbol: string;
  assetName?: string;
  transactionType: CongressTradeType;
  /** ISO YYYY-MM-DD — STOCK Act discloses date, not time. */
  transactionDate: string;
  filingDate?: string;
  amountLow?: number;
  amountHigh?: number;
  amountMid?: number;
  ownerType?: string;
  position?: string;
  source: string;
  filingId?: string;
  createdAt: string;
}

export interface CongressMemberStats {
  memberId: string;
  period: CongressStatPeriod;
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  uniqueSymbols: number;
  estVolumeUsd: number;

  /** Member's avg 30d return - SPY's return over same window. Positive = alpha. */
  timingAlpha30dPct: number | null;
  timingAlpha90dPct: number | null;
  winRate30d: number | null;
  avgForwardReturn30dPct: number | null;

  topSymbol?: string;
  topSymbolTrades?: number;

  qualifies: boolean;
  computedAt: string;
}

// ─────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────

export interface CongressLeaderEntry {
  rank: number;
  member: CongressMember;
  stats: CongressMemberStats;
}

// ─────────────────────────────────────────────
// Profile (assembled read model)
// ─────────────────────────────────────────────

export interface CongressProfileView {
  member: CongressMember;
  stats: Record<CongressStatPeriod, CongressMemberStats | null>;
  recentTrades: CongressTrade[];
  /** Breakdown: top N symbols by trade count (desc). */
  topSymbols: Array<{
    symbol: string;
    tradeCount: number;
    buyCount: number;
    sellCount: number;
    estVolumeUsd: number;
  }>;
}

// ─────────────────────────────────────────────
// Slug helpers
// ─────────────────────────────────────────────

/**
 * Convert a raw filing name ("Pelosi, Nancy" / "Nancy Pelosi" / "Hon. Nancy Pelosi")
 * into a stable URL-safe slug. Idempotent.
 */
export function slugifyMemberName(raw: string): string {
  const cleaned = raw
    .replace(/^\s*(hon\.?|rep\.?|sen\.?|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ") // remove parenthetical party/state
    .trim();

  // "Last, First Middle" → "First Middle Last"
  const parts = cleaned.includes(",")
    ? (() => {
        const [last, rest] = cleaned.split(",", 2);
        return `${rest.trim()} ${last.trim()}`;
      })()
    : cleaned;

  return parts
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "unknown";
}

/**
 * Normalize Finnhub's transactionType field into our 4-value enum.
 * Finnhub ships "Purchase", "Sale (Full)", "Sale (Partial)", "Exchange".
 */
export function normalizeTransactionType(raw: string | undefined | null): CongressTradeType {
  if (!raw) return "other";
  const s = raw.toLowerCase();
  if (s.includes("purchase") || s === "buy") return "buy";
  if (s.includes("sale") || s === "sell" || s.includes("sold")) return "sell";
  if (s.includes("exchange")) return "exchange";
  return "other";
}
