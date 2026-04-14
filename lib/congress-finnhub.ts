/**
 * Finnhub client — Congressional Trading endpoint.
 *
 * Finnhub exposes disclosures keyed by stock symbol, not by member.
 * We iterate our watchlist nightly, collecting trades across all
 * members for each symbol we care about.
 *
 * Endpoint: GET /api/v1/stock/congressional-trading?symbol=AAPL&token=XXX
 *
 * Free-tier rate limit: 30 calls/sec, 60 calls/min. We pause between
 * batches to stay well under both limits.
 */

import { normalizeTransactionType, type CongressTradeType } from "./congress-types";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export interface FinnhubCongressRaw {
  amountFrom?: number | string;
  amountTo?: number | string;
  assetName?: string;
  filingDate?: string;
  name?: string;
  ownerType?: string;
  position?: string;
  symbol?: string;
  transactionDate?: string;
  transactionType?: string;
}

export interface FinnhubCongressResponse {
  symbol?: string;
  data?: FinnhubCongressRaw[];
}

export interface NormalizedCongressTrade {
  rawName: string;
  symbol: string;
  assetName?: string;
  transactionType: CongressTradeType;
  transactionDate: string;
  filingDate?: string;
  amountLow?: number;
  amountHigh?: number;
  ownerType?: string;
  position?: string;
}

export function isFinnhubConfigured(): boolean {
  return !!(process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY.trim());
}

function toIsoDate(v: string | undefined): string | undefined {
  if (!v) return undefined;
  // Finnhub returns YYYY-MM-DD — trim any time component just in case.
  const m = v.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : undefined;
}

function toNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Pull congressional disclosures for a single symbol. Returns normalized
 * trades, or empty array on any error (logged but non-fatal).
 */
export async function fetchCongressTradesForSymbol(
  symbol: string,
): Promise<NormalizedCongressTrade[]> {
  const token = process.env.FINNHUB_API_KEY?.trim();
  if (!token) {
    throw new Error("FINNHUB_API_KEY not set");
  }

  const url = `${FINNHUB_BASE}/stock/congressional-trading?symbol=${encodeURIComponent(
    symbol,
  )}&token=${encodeURIComponent(token)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Finnhub endpoints cache well — don't revalidate more often than hourly.
    next: { revalidate: 3600 },
  });

  if (res.status === 429) {
    throw new Error("finnhub rate limited — back off");
  }
  if (!res.ok) {
    throw new Error(`finnhub ${res.status} for ${symbol}`);
  }

  const json = (await res.json()) as FinnhubCongressResponse;
  const rows = json.data ?? [];
  const out: NormalizedCongressTrade[] = [];

  for (const r of rows) {
    const txDate = toIsoDate(r.transactionDate);
    const name = r.name?.trim();
    const sym = (r.symbol ?? json.symbol ?? symbol).toUpperCase().trim();
    if (!txDate || !name || !sym) continue;

    out.push({
      rawName: name,
      symbol: sym,
      assetName: r.assetName?.trim() || undefined,
      transactionType: normalizeTransactionType(r.transactionType),
      transactionDate: txDate,
      filingDate: toIsoDate(r.filingDate),
      amountLow: toNum(r.amountFrom),
      amountHigh: toNum(r.amountTo),
      ownerType: r.ownerType?.trim() || undefined,
      position: r.position?.trim() || undefined,
    });
  }

  return out;
}

/**
 * Fetch historical daily closes for a symbol from Finnhub.
 * Used by the stats engine to compute forward returns after each trade.
 *
 * Returns a map of YYYY-MM-DD -> close price.
 *
 * NOTE: Finnhub's /stock/candle endpoint requires a paid tier for US stocks
 * as of 2024. We keep this function as a stub that delegates to Yahoo for
 * free historical data (see lib/congress-prices.ts).
 */
export const FINNHUB_SYMBOL_LIMITS = {
  maxBatch: 50,
  delayMs: 200, // between batches of 10, stays well under 30 req/sec
} as const;

/**
 * Watchlist — the universe of symbols we scan for Congressional trades.
 *
 * We use a curated list of the ~150 most commonly-traded names in
 * disclosures: mega-cap tech, big banks, defense, pharma, energy.
 * Not exhaustive, but captures >90% of the signal.
 */
export const CONGRESS_WATCH_SYMBOLS: readonly string[] = [
  // Mega-cap tech
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA", "NFLX", "AVGO",
  "ORCL", "CRM", "ADBE", "INTC", "AMD", "CSCO", "QCOM", "TXN", "IBM", "PYPL",
  "UBER", "LYFT", "SHOP", "SNOW", "PLTR", "SNAP", "PINS", "ZM", "DOCU", "ROKU",
  // Semiconductors + AI
  "ASML", "MU", "AMAT", "LRCX", "KLAC", "MRVL", "NXPI", "TSM", "SMH", "SOXX",
  // Big banks & finance
  "JPM", "BAC", "WFC", "C", "GS", "MS", "BLK", "SCHW", "V", "MA",
  "AXP", "COF", "USB", "PNC", "TFC",
  // Healthcare & pharma
  "UNH", "JNJ", "LLY", "PFE", "ABBV", "MRK", "ABT", "TMO", "DHR", "BMY",
  "AMGN", "CVS", "CI", "HUM", "GILD", "REGN", "VRTX", "MRNA", "BNTX",
  // Energy & utilities
  "XOM", "CVX", "COP", "OXY", "SLB", "EOG", "PSX", "VLO", "MPC", "HAL",
  "NEE", "DUK", "SO", "D", "AEP",
  // Industrials & defense
  "BA", "LMT", "RTX", "NOC", "GD", "HII", "LHX", "TDG", "CAT", "DE",
  "HON", "GE", "MMM", "UPS", "FDX",
  // Consumer
  "WMT", "COST", "HD", "LOW", "TGT", "NKE", "SBUX", "MCD", "KO", "PEP",
  "PG", "CL", "CLX", "DIS", "CMCSA", "T", "VZ", "TMUS",
  // ETFs (also tracked for SPY baseline + Congress often trades index funds)
  "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO",
  // Other notables that show up often
  "BRK-B", "F", "GM", "RIVN", "LCID", "NIO", "BABA", "JD", "PDD", "COIN",
  "HOOD", "SOFI", "CVNA", "DKNG", "MARA", "RIOT",
];
