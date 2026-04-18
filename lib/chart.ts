/**
 * Chart data fetcher shared between the `/chart/[symbol]` page and its
 * `/api/chart/[symbol]` proxy. Same Yahoo chart endpoint the watchlist +
 * scanner already use — just a different (interval, range) pair per
 * timeframe button.
 */

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

export type ChartRange = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y";

export interface ChartRangeSpec {
  interval: string;
  range: string;
}

/**
 * Yahoo (interval, range) pairs per timeframe button. Picked so each
 * view has enough bars to feel dense without being noisy — 5m intraday,
 * 1h for the week, daily for everything ≥1M, weekly for multi-year.
 */
export const CHART_RANGES: Record<ChartRange, ChartRangeSpec> = {
  "1D": { interval: "5m", range: "1d" },
  "5D": { interval: "30m", range: "5d" },
  "1M": { interval: "1h", range: "1mo" },
  "6M": { interval: "1d", range: "6mo" },
  "1Y": { interval: "1d", range: "1y" },
  "5Y": { interval: "1wk", range: "5y" },
};

export interface Candle {
  /** UTC timestamp in seconds — lightweight-charts' native time format. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeBar {
  time: number;
  value: number;
  /** Colored green when close ≥ open, red otherwise. Prevents a second pass in the client. */
  color: string;
}

export interface ChartResponse {
  symbol: string;
  name?: string;
  range: ChartRange;
  currency?: string;
  exchange?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  changePct?: number;
  candles: Candle[];
  volumes: VolumeBar[];
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        currency?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

const UP = "rgba(34, 197, 94, 0.5)";   // green/500 @ 50%
const DOWN = "rgba(239, 68, 68, 0.5)"; // red/500 @ 50%

export function isChartRange(value: string): value is ChartRange {
  return value in CHART_RANGES;
}

export function parseRange(raw: string | null | undefined): ChartRange {
  if (raw && isChartRange(raw)) return raw;
  return "1Y";
}

export async function fetchChart(
  symbol: string,
  range: ChartRange
): Promise<ChartResponse | null> {
  const spec = CHART_RANGES[range];
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=${spec.interval}&range=${spec.range}&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; BuyOrBeSoldChart/1.0; +https://buyorbesold.com)",
      Accept: "application/json",
    },
    // Intraday frames move constantly; daily frames barely change during
    // market hours. 60s is a fair middle ground and matches the watchlist.
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as YahooChartResponse;
  const result = json.chart?.result?.[0];
  if (!result?.meta || !result.timestamp?.length) return null;

  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp;
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];

  const candles: Candle[] = [];
  const volBars: VolumeBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    if (
      typeof t !== "number" ||
      typeof o !== "number" ||
      typeof h !== "number" ||
      typeof l !== "number" ||
      typeof c !== "number" ||
      !Number.isFinite(o)
    ) {
      continue;
    }
    candles.push({ time: t, open: o, high: h, low: l, close: c });
    const v = volumes[i];
    if (typeof v === "number" && Number.isFinite(v)) {
      volBars.push({ time: t, value: v, color: c >= o ? UP : DOWN });
    }
  }

  if (!candles.length) return null;

  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const prev = meta.previousClose ?? meta.chartPreviousClose;
  const changePct =
    typeof price === "number" && typeof prev === "number" && prev
      ? ((price - prev) / prev) * 100
      : undefined;

  return {
    symbol: meta.symbol ?? symbol,
    name: meta.shortName ?? meta.longName,
    range,
    currency: meta.currency,
    exchange: meta.exchangeName,
    regularMarketPrice: price,
    previousClose: prev,
    changePct,
    candles,
    volumes: volBars,
  };
}
