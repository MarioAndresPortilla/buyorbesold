/**
 * Historical price fetcher for the Congress stats engine.
 *
 * Finnhub's free tier doesn't include US historical candles, so we
 * pull from Yahoo Finance (same source as lib/markets.ts uses for
 * intraday data) and cache daily closes in the congress_price_snapshots
 * table. That cache keeps the stats cron from hammering Yahoo every run.
 */

import { query } from "./db";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const USER_AGENT =
  "Mozilla/5.0 (compatible; BuyOrBeSoldBot/1.0; +https://buyorbesold.com)";

interface YahooChart {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
}

/**
 * Fetch daily closes for `symbol` from Yahoo, covering at least
 * `fromDate` through today. Returns a map of YYYY-MM-DD -> close.
 */
export async function fetchYahooDailyCloses(
  symbol: string,
  fromDate: string,
): Promise<Record<string, number>> {
  const fromTs = Math.floor(new Date(fromDate + "T00:00:00Z").getTime() / 1000);
  const toTs = Math.floor(Date.now() / 1000);
  const url =
    `${YAHOO_BASE}/${encodeURIComponent(symbol)}` +
    `?interval=1d&period1=${fromTs}&period2=${toTs}&includePrePost=false`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`yahoo ${res.status} for ${symbol}`);

  const json = (await res.json()) as YahooChart;
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];

  const out: Record<string, number> = {};
  for (let i = 0; i < ts.length; i++) {
    const close = closes[i];
    if (typeof close !== "number" || !Number.isFinite(close)) continue;
    const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    out[date] = close;
  }
  return out;
}

/**
 * Get a single daily close for (symbol, date) — checking the cache
 * first, then Yahoo. Accepts ±5 trading-day fuzziness (weekends,
 * holidays) by walking forward until it finds a close.
 */
export async function getClosePrice(
  symbol: string,
  targetDate: string,
  maxForwardDays = 5,
): Promise<number | null> {
  // 1. Try cache: any row within the forward window
  const cached = await query<{ date: string; close: string | number }>`
    SELECT date::text AS date, close FROM congress_price_snapshots
    WHERE symbol = ${symbol}
      AND date >= ${targetDate}
      AND date <= ${targetDate}::date + ${maxForwardDays}::integer
    ORDER BY date ASC
    LIMIT 1
  `;
  if (cached.length > 0) {
    const n = Number(cached[0].close);
    return Number.isFinite(n) ? n : null;
  }

  // 2. Cache miss — fetch a window from Yahoo and backfill the cache
  try {
    const closes = await fetchYahooDailyCloses(symbol, targetDate);
    await cacheCloses(symbol, closes);
    for (let i = 0; i <= maxForwardDays; i++) {
      const d = addDays(targetDate, i);
      if (d in closes) return closes[d];
    }
  } catch (err) {
    console.warn(`[congress-prices] ${symbol} ${targetDate} fetch failed:`, err);
  }
  return null;
}

/**
 * Upsert a batch of daily closes into congress_price_snapshots.
 */
export async function cacheCloses(
  symbol: string,
  closes: Record<string, number>,
): Promise<void> {
  const entries = Object.entries(closes);
  if (entries.length === 0) return;

  // Neon's tagged template doesn't do multi-row VALUES interpolation cleanly;
  // loop with ON CONFLICT DO NOTHING. ~250 rows max per symbol is fine.
  for (const [date, close] of entries) {
    await query`
      INSERT INTO congress_price_snapshots (symbol, date, close)
      VALUES (${symbol}, ${date}::date, ${close})
      ON CONFLICT (symbol, date) DO NOTHING
    `;
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the % return of `symbol` from `fromDate` to `fromDate + holdDays`.
 * Returns null if either close is unavailable.
 */
export async function forwardReturnPct(
  symbol: string,
  fromDate: string,
  holdDays: number,
): Promise<number | null> {
  const toDate = addDays(fromDate, holdDays);
  const [p0, p1] = await Promise.all([
    getClosePrice(symbol, fromDate),
    getClosePrice(symbol, toDate),
  ]);
  if (p0 == null || p1 == null || p0 <= 0) return null;
  return ((p1 - p0) / p0) * 100;
}
