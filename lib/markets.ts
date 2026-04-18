import type {
  DualFearGreed,
  FearGreed,
  MacroEvent,
  MacroStats,
  MarketData,
  Sector,
  Ticker,
} from "./types";

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
    yahooSymbol: symbol,
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

type CoinGeckoGlobal = {
  data?: {
    total_market_cap?: { usd?: number };
    market_cap_percentage?: { btc?: number };
    market_cap_change_percentage_24h_usd?: number;
  };
};

const FALLBACK_MACRO: MacroStats = {
  btcDominance: 0,
  btcDominanceDelta: 0,
  cryptoMktCap: 0,
  cryptoMktCapChangePct: 0,
  stale: true,
};

/** CoinGecko /global — real BTC dominance + total crypto market cap. */
export async function fetchMacroStats(): Promise<MacroStats> {
  try {
    const json = await fetchJson<CoinGeckoGlobal>(`${COINGECKO_BASE}/global`);
    const d = json.data;
    if (!d) return FALLBACK_MACRO;
    return {
      btcDominance: d.market_cap_percentage?.btc ?? 0,
      // CoinGecko doesn't expose a dominance delta directly; show 0 rather than fake one.
      btcDominanceDelta: 0,
      cryptoMktCap: d.total_market_cap?.usd ?? 0,
      cryptoMktCapChangePct: d.market_cap_change_percentage_24h_usd ?? 0,
    };
  } catch (err) {
    console.warn("[markets] global fetch warn:", err);
    return FALLBACK_MACRO;
  }
}

/** Crypto Fear & Greed Index from alternative.me (BTC-focused). */
export async function fetchCryptoFearGreed(): Promise<FearGreed> {
  try {
    const json = await fetchJson<FngResponse>(`${FNG_BASE}/?limit=1`);
    const entry = json.data?.[0];
    const score = entry?.value ? parseInt(entry.value, 10) : NaN;
    const label = entry?.value_classification ?? "Neutral";
    if (!Number.isFinite(score)) return { score: 50, label: "Neutral", stale: true };
    return { score, label };
  } catch {
    return { score: 50, label: "Neutral", stale: true };
  }
}

type CnnFngResponse = {
  fear_and_greed?: {
    score?: number;
    rating?: string;
  };
};

/** CNN Fear & Greed Index (stock market — VIX, put/call, junk bond demand, etc.). */
export async function fetchStockFearGreed(): Promise<FearGreed> {
  try {
    const res = await fetch(
      "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "*/*",
          Referer: "https://www.cnn.com/markets/fear-and-greed",
        },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) throw new Error(`CNN FNG ${res.status}`);
    const json = (await res.json()) as CnnFngResponse;
    const raw = json.fear_and_greed?.score;
    const rating = json.fear_and_greed?.rating ?? "Neutral";
    if (raw == null || !Number.isFinite(raw)) {
      return { score: 50, label: "Neutral", stale: true };
    }
    const score = Math.round(raw);
    // CNN returns lowercase — capitalize first letter of each word.
    const label = rating.replace(/\b\w/g, (c) => c.toUpperCase());
    return { score, label };
  } catch {
    return { score: 50, label: "Neutral", stale: true };
  }
}

/** Fetch both Fear & Greed indexes in parallel. */
export async function fetchFearGreed(): Promise<DualFearGreed> {
  const [stock, crypto] = await Promise.all([
    fetchStockFearGreed(),
    fetchCryptoFearGreed(),
  ]);
  return { stock, crypto };
}

// Placeholder used when a fetch fails — keeps the dashboard from crashing.
export function fallbackTicker(symbol: string, name?: string): Ticker {
  return {
    symbol,
    yahooSymbol: symbol,
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

// SPDR sector ETFs — the standard 10 S&P 500 sector proxies plus communication services (XLC).
// Code → (symbol, display name). Includes XLC which was split off from XLK in 2018.
const SECTOR_ETFS: Array<{ code: string; symbol: string; name: string }> = [
  { code: "TECH", symbol: "XLK", name: "Technology" },
  { code: "ENERGY", symbol: "XLE", name: "Energy" },
  { code: "FINANCE", symbol: "XLF", name: "Financials" },
  { code: "HEALTH", symbol: "XLV", name: "Healthcare" },
  { code: "CONSUM", symbol: "XLY", name: "Consumer Disc." },
  { code: "INDUST", symbol: "XLI", name: "Industrials" },
  { code: "UTIL", symbol: "XLU", name: "Utilities" },
  { code: "REIT", symbol: "XLRE", name: "Real Estate" },
  { code: "MATS", symbol: "XLB", name: "Materials" },
  { code: "COMMS", symbol: "XLC", name: "Communications" },
];

// ---- Economic calendar (Finnhub) ------------------------------------------
// Finnhub's /calendar/economic returns scheduled releases with actual/forecast
// values as they print. We pull a rolling Mon–Sun window around "today" so
// the dashboard always shows "this week" regardless of which day it is.

type FinnhubEconomicEvent = {
  actual?: number | string | null;
  country?: string;
  estimate?: number | string | null;
  event?: string;
  impact?: string; // "low" | "medium" | "high"
  prev?: number | string | null;
  time?: string; // "YYYY-MM-DD HH:mm:SS" UTC
  unit?: string;
};

// Finnhub's docs show the calendar as a flat array under `economicCalendar`,
// but some tiers wrap it in `{ result: [...] }` — accept either shape.
type FinnhubEconomicResp = {
  economicCalendar?:
    | FinnhubEconomicEvent[]
    | { result?: FinnhubEconomicEvent[] };
  // A few Finnhub error responses put the message here.
  error?: string;
};

function formatMacroValue(v: unknown, unit?: string): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) {
    const s = String(v).trim();
    return s || undefined;
  }
  // Heuristic formatting: K/M for volumes, % for percents, otherwise raw.
  const u = (unit ?? "").trim();
  if (u === "%" || u.toLowerCase() === "percent") return `${n.toFixed(1)}%`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

/**
 * This week's US macro calendar (Mon–Sun around "now") from Finnhub. Returns
 * an empty array when the key is missing or the call fails — the UI then
 * falls back to its static defaults so the dashboard still renders.
 */
export async function fetchEconomicCalendar(): Promise<MacroEvent[]> {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) return [];

  // Monday of this week in UTC → Sunday. Keeps the view stable for users
  // hitting the dashboard mid-week and avoids "empty Saturday".
  const now = new Date();
  const dow = now.getUTCDay(); // 0 = Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const from = monday.toISOString().slice(0, 10);
  const to = sunday.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${apiKey}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Events don't change often, but the `actual` value updates the moment
      // a print hits the tape — 30 min keeps post-release numbers fresh
      // without hammering the free tier.
      next: { revalidate: 60 * 30 },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `finnhub econ ${res.status} ${body.slice(0, 200)}`
      );
    }
    const json = (await res.json()) as FinnhubEconomicResp;
    if (json.error) {
      console.warn("[markets] finnhub econ error:", json.error);
      return [];
    }
    const payload = json.economicCalendar;
    const raw: FinnhubEconomicEvent[] = Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.result)
        ? payload.result
        : [];
    if (raw.length === 0) {
      console.warn(
        `[markets] finnhub econ calendar returned 0 rows for ${from}..${to}`
      );
    }
    const usOnly = raw.filter(
      (e) => (e.country ?? "").toUpperCase() === "US" && e.event
    );

    // High > medium > low, within a day sort by time.
    const impactOf = (i?: string): MacroEvent["impact"] => {
      const v = (i ?? "").toLowerCase();
      if (v === "high") return "HIGH";
      if (v === "medium" || v === "med") return "MED";
      return "LOW";
    };

    const mapped = usOnly
      .map<MacroEvent | null>((e) => {
        if (!e.time || !e.event) return null;
        const dt = new Date(e.time.replace(" ", "T") + "Z");
        if (!Number.isFinite(dt.getTime())) return null;
        // Render weekday + HH:mm in America/New_York so readers and the
        // Finnhub event line up (Finnhub returns UTC).
        const weekday = dt
          .toLocaleDateString("en-US", {
            timeZone: "America/New_York",
            weekday: "short",
          })
          .toUpperCase();
        const time = dt.toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const impact = impactOf(e.impact);
        const previous = formatMacroValue(e.prev, e.unit);
        const estimate = formatMacroValue(
          e.actual ?? e.estimate,
          e.unit
        );
        // YYYY-MM-DD in America/New_York for the event date — used by the
        // UI to render "Apr 10" alongside the weekday code.
        const isoDate = dt
          .toLocaleDateString("en-CA", { timeZone: "America/New_York" })
          .slice(0, 10);
        return {
          day: weekday,
          time: `${time} ET`,
          date: isoDate,
          name: e.event,
          previous,
          estimate,
          impact,
          _sortKey: dt.getTime(),
        } as MacroEvent & { _sortKey: number };
      })
      .filter((e): e is MacroEvent & { _sortKey: number } => e !== null);

    // Surface the whole week, but anchor the list on the reader's "today"
    // instead of Monday — upcoming events (today + future) come first in
    // chronological order, then past events in reverse chronological
    // order (yesterday before Monday). That keeps page 1 focused on what
    // actually matters when someone loads the dashboard mid-week.
    const todayStart = (() => {
      const ymd = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });
      const [y, m, d] = ymd.split("-").map(Number);
      return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
    })();
    const upcoming = mapped
      .filter((e) => e._sortKey >= todayStart)
      .sort((a, b) => a._sortKey - b._sortKey);
    const past = mapped
      .filter((e) => e._sortKey < todayStart)
      .sort((a, b) => b._sortKey - a._sortKey);
    const combined = [...upcoming, ...past];
    return combined.map(({ _sortKey: _s, ...rest }) => rest);
  } catch (err) {
    console.warn("[markets] finnhub econ calendar fail:", err);
    return [];
  }
}

export async function fetchSectors(): Promise<Sector[]> {
  const results = await Promise.all(
    SECTOR_ETFS.map(async ({ code, symbol, name }) => {
      try {
        const t = await fetchYahoo(symbol, symbol, name);
        return { code, name, changePct: t.changePct } satisfies Sector;
      } catch (err) {
        console.warn(`[markets] sector ${symbol} fetch warn:`, err);
        return { code, name, changePct: 0 } satisfies Sector;
      }
    })
  );
  return results;
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
    vix,
    macro,
    sectors,
    fearGreed,
    economicCalendar,
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
    safeYahoo("^VIX", "VIX", "Volatility Index"),
    fetchMacroStats(),
    fetchSectors(),
    fetchFearGreed(),
    fetchEconomicCalendar(),
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
    vix,
    macro,
    sectors,
    fearGreed,
    economicCalendar,
    updatedAt: new Date().toISOString(),
  };
}
