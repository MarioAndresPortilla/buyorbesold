import type { FearGreed, MarketData, Ticker } from "./types";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const FNG_BASE = "https://api.alternative.me/fng";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BuyOrBeSoldBot/1.0; +https://buyorbesold.com)";

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketVolume?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
    error?: unknown;
  };
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

export async function fetchYahoo(
  symbol: string,
  displaySymbol?: string,
  name?: string
): Promise<Ticker> {
  // Use a short intraday range for the sparkline; meta still carries full 52w + previousClose.
  const url = `${YAHOO_BASE}/${encodeURIComponent(
    symbol
  )}?interval=15m&range=5d&includePrePost=false`;
  const json = await fetchJson<YahooChart>(url);
  const result = json.chart?.result?.[0];
  if (!result || !result.meta) {
    throw new Error(`Yahoo: no data for ${symbol}`);
  }
  const meta = result.meta;
  const price = meta.regularMarketPrice ?? 0;
  // previousClose is the prior session close — what "daily change" should reference.
  // chartPreviousClose is the close at the start of the chart range (e.g. 5 days ago) and is NOT the daily prev.
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const change = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;

  const closes = (result.indicators?.quote?.[0]?.close ?? [])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  // Build a 24-point history (downsample if needed) from the most recent intraday closes.
  const history = downsample(closes, 24);

  return {
    symbol: displaySymbol ?? symbol,
    name,
    price,
    change,
    changePct,
    low52: meta.fiftyTwoWeekLow ?? Math.min(...(closes.length ? closes : [price])),
    high52: meta.fiftyTwoWeekHigh ?? Math.max(...(closes.length ? closes : [price])),
    volume: meta.regularMarketVolume
      ? compact(meta.regularMarketVolume)
      : undefined,
    history,
  };
}

function downsample(values: number[], target: number): number[] {
  if (values.length === 0) return [];
  if (values.length <= target) return values;
  const out: number[] = [];
  const step = values.length / target;
  for (let i = 0; i < target; i++) {
    const idx = Math.floor(i * step);
    out.push(values[idx]);
  }
  // Always include the most recent value as the final point.
  out[out.length - 1] = values[values.length - 1];
  return out;
}

function compact(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${n}`;
}

type CoinGeckoSimple = {
  bitcoin?: {
    usd?: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
  };
};

// Best-effort augmentation: fetch BTC market cap from CoinGecko.
// Non-fatal on failure — Yahoo is the source of truth for price/change/52w.
async function fetchBitcoinMarketCap(): Promise<number | undefined> {
  try {
    const json = await fetchJson<CoinGeckoSimple>(
      `${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true`
    );
    return json.bitcoin?.usd_market_cap;
  } catch (err) {
    console.warn("[markets] btc mktcap fetch warn:", err);
    return undefined;
  }
}

export async function fetchBitcoin(): Promise<Ticker> {
  // Yahoo's BTC-USD returns the same shape as every other ticker: real 52w range,
  // real daily previousClose, intraday history. Everything we need in one call.
  const ticker = await fetchYahoo("BTC-USD", "BTC", "Bitcoin");
  const mktcap = await fetchBitcoinMarketCap();
  return { ...ticker, mktcap };
}

type FngResponse = {
  data?: Array<{ value?: string; value_classification?: string }>;
};

export async function fetchFearGreed(): Promise<FearGreed> {
  try {
    const json = await fetchJson<FngResponse>(`${FNG_BASE}/?limit=1`);
    const entry = json.data?.[0];
    const score = entry?.value ? parseInt(entry.value, 10) : 50;
    const label = entry?.value_classification ?? "Neutral";
    return { score: Number.isFinite(score) ? score : 50, label };
  } catch {
    return { score: 50, label: "Neutral" };
  }
}

// Placeholder used when a fetch fails — keeps the dashboard from crashing.
export function fallbackTicker(symbol: string, name?: string): Ticker {
  return {
    symbol,
    name,
    price: 0,
    change: 0,
    changePct: 0,
    low52: 0,
    high52: 0,
    history: [],
  };
}

export async function safeYahoo(
  symbol: string,
  display?: string,
  name?: string
): Promise<Ticker> {
  try {
    return await fetchYahoo(symbol, display, name);
  } catch (err) {
    console.error(`[markets] yahoo fail ${symbol}:`, err);
    return fallbackTicker(display ?? symbol, name);
  }
}

export async function safeBitcoin(): Promise<Ticker> {
  try {
    return await fetchBitcoin();
  } catch (err) {
    console.error("[markets] bitcoin fail:", err);
    return fallbackTicker("BTC", "Bitcoin");
  }
}

export async function fetchAllMarkets(): Promise<MarketData> {
  const [
    sp500,
    bitcoin,
    gold,
    silver,
    platinum,
    crude,
    natgas,
    copper,
    qqq,
    voo,
    vti,
    dia,
    dxy,
    tnx,
    fearGreed,
  ] = await Promise.all([
    safeYahoo("^GSPC", "SPX", "S&P 500"),
    safeBitcoin(),
    safeYahoo("GC=F", "GOLD", "Gold"),
    safeYahoo("SI=F", "SILVER", "Silver"),
    safeYahoo("PL=F", "PLAT", "Platinum"),
    safeYahoo("CL=F", "CRUDE", "Crude Oil"),
    safeYahoo("NG=F", "NATGAS", "Natural Gas"),
    safeYahoo("HG=F", "COPPER", "Copper"),
    safeYahoo("QQQ", "QQQ", "Invesco QQQ Trust"),
    safeYahoo("VOO", "VOO", "Vanguard S&P 500"),
    safeYahoo("VTI", "VTI", "Vanguard Total Market"),
    safeYahoo("DIA", "DIA", "SPDR Dow Jones"),
    safeYahoo("DX-Y.NYB", "DXY", "US Dollar Index"),
    safeYahoo("^TNX", "TNX", "10Y Treasury Yield"),
    fetchFearGreed(),
  ]);

  return {
    sp500,
    bitcoin,
    gold,
    silver,
    platinum,
    crude,
    natgas,
    copper,
    qqq,
    voo,
    vti,
    dia,
    dxy,
    tnx,
    fearGreed,
    updatedAt: new Date().toISOString(),
  };
}
