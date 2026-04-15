import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WatchlistEntry, WatchlistItem } from "./types";

/**
 * Watchlist = Mario's curated list of tickers he's actively watching.
 * Stored as a JSON file in /content so he can edit + git-push.
 *
 * Each entry is enriched at request time with live price / RVOL / SMA distance
 * using the same Yahoo historical endpoint the scanner uses.
 */

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

interface WatchlistFile {
  updatedAt?: string;
  items: WatchlistItem[];
}

export function loadWatchlistFile(): WatchlistFile {
  try {
    const path = join(process.cwd(), "content", "watchlist.json");
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as WatchlistFile;
  } catch (err) {
    console.warn("[watchlist] load fail:", err);
    return { items: [] };
  }
}

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketVolume?: number;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

async function fetchYahooChart(symbol: string): Promise<YahooChart> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; BuyOrBeSoldWatchlist/1.0; +https://buyorbesold.com)",
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`yahoo ${res.status} ${symbol}`);
  return (await res.json()) as YahooChart;
}

function sma(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export async function enrichSymbols(
  items: WatchlistItem[]
): Promise<WatchlistEntry[]> {
  if (!items.length) return [];

  const enriched = await Promise.all(
    items.map(async (item): Promise<WatchlistEntry | null> => {
      try {
        const json = await fetchYahooChart(item.symbol);
        const result = json.chart?.result?.[0];
        if (!result?.meta) return null;
        const meta = result.meta;
        const price = meta.regularMarketPrice ?? 0;
        const prev = meta.previousClose ?? price;
        const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v)
        );
        const vols = (result.indicators?.quote?.[0]?.volume ?? []).filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v)
        );
        const sma50 = sma(closes, 50);
        const sma200 = sma(closes, 200);
        const last10 = vols.slice(-11, -1);
        const avgVol10 = last10.length
          ? last10.reduce((a, b) => a + b, 0) / last10.length
          : 0;
        const todayVol = meta.regularMarketVolume ?? vols[vols.length - 1] ?? 0;
        const rvol = avgVol10 > 0 ? todayVol / avgVol10 : 0;

        return {
          symbol: item.symbol,
          name: meta.shortName,
          note: item.note,
          price,
          changePct: prev ? ((price - prev) / prev) * 100 : 0,
          rvol,
          sma50,
          sma200,
          sma50Delta: sma50 ? ((price - sma50) / sma50) * 100 : undefined,
          sma200Delta: sma200 ? ((price - sma200) / sma200) * 100 : undefined,
        };
      } catch (err) {
        console.warn(`[watchlist] enrich fail ${item.symbol}:`, err);
        return null;
      }
    })
  );

  return enriched.filter((e): e is WatchlistEntry => e !== null);
}

export async function enrichWatchlist(): Promise<WatchlistEntry[]> {
  const { items } = loadWatchlistFile();
  return enrichSymbols(items);
}

/**
 * Validate that a symbol resolves on Yahoo before we accept it into a user's
 * watchlist. Returns the canonical uppercase symbol + display name on success.
 */
export async function validateSymbol(
  raw: string
): Promise<{ symbol: string; name?: string } | null> {
  const symbol = raw.trim().toUpperCase();
  if (!symbol || symbol.length > 16 || !/^[A-Z0-9.\-^]+$/.test(symbol)) return null;
  try {
    const json = await fetchYahooChart(symbol);
    const result = json.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price)) return null;
    return { symbol, name: result?.meta?.shortName };
  } catch {
    return null;
  }
}
