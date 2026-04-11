import type { ScannerResult, SetupCandidate } from "./types";

/**
 * Scanner for Mario's day-trading setup:
 *   - Price $1–$20
 *   - Float < 20M shares (requires FINNHUB_API_KEY)
 *   - Volume > 1.5x 10-day average (RVOL)
 *   - Price within 2% of 50-day or 200-day SMA (bounce setup)
 *
 * Data flow:
 *   1. Yahoo predefined screeners → candidate pool (~150 tickers)
 *   2. Yahoo per-ticker history (1y daily) → compute SMA50, SMA200, 10d avg vol, RVOL
 *   3. Finnhub /stock/profile2 → float (optional; scanner degrades without it)
 *   4. Score + rank → top 3 long, top 3 short
 *
 * Rate limit strategy: pre-filter to ~30 survivors by price+RVOL using data
 * we already have from the screener, then only hit Finnhub for those 30.
 */

const YAHOO_SCREENER =
  "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved";
const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const FINNHUB_BASE = "https://finnhub.io/api/v1";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BuyOrBeSoldScanner/1.0; +https://buyorbesold.com)";

const CRITERIA = {
  priceMin: 1,
  priceMax: 20,
  maxFloat: 20_000_000,
  minRvol: 1.5,
  smaBouncePct: 0.02, // within 2% of the MA
  maxCandidates: 30, // hard cap on Finnhub calls per scan
} as const;

type YahooScreenerQuote = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  averageDailyVolume10Day?: number;
  marketCap?: number;
};

type YahooScreenerResp = {
  finance?: {
    result?: Array<{
      quotes?: YahooScreenerQuote[];
    }>;
    error?: unknown;
  };
};

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
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

type FinnhubProfile = {
  shareOutstanding?: number;
  marketCapitalization?: number;
  name?: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    // Scanner data refreshes every 5 min via ISR on the route handler.
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Fetch ${res.status} ${url}`);
  return (await res.json()) as T;
}

async function fetchYahooScreener(scrId: string, count = 100): Promise<YahooScreenerQuote[]> {
  const url = `${YAHOO_SCREENER}?scrIds=${encodeURIComponent(scrId)}&count=${count}`;
  const json = await fetchJson<YahooScreenerResp>(url);
  return json.finance?.result?.[0]?.quotes ?? [];
}

async function fetchYahooHistory(symbol: string): Promise<{
  closes: number[];
  volumes: number[];
  price: number;
  prevClose: number;
  todayVolume: number;
}> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const json = await fetchJson<YahooChart>(url);
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`yahoo history empty for ${symbol}`);
  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  const volumes = (result.indicators?.quote?.[0]?.volume ?? []).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  return {
    closes,
    volumes,
    price: result.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 0,
    prevClose: result.meta?.previousClose ?? closes[closes.length - 2] ?? 0,
    todayVolume: result.meta?.regularMarketVolume ?? volumes[volumes.length - 1] ?? 0,
  };
}

async function fetchFinnhubProfile(symbol: string, apiKey: string): Promise<FinnhubProfile | null> {
  try {
    const url = `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    return await fetchJson<FinnhubProfile>(url);
  } catch (err) {
    console.warn(`[scanner] finnhub profile fail ${symbol}:`, err);
    return null;
  }
}

function simpleMA(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined;
  const slice = values.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

interface EnrichedCandidate {
  symbol: string;
  name?: string;
  price: number;
  prevClose: number;
  changePct: number;
  volume: number;
  avgVol10d: number;
  rvol: number;
  marketCap?: number;
  sma50?: number;
  sma200?: number;
  smaDistance?: number;
  smaBounce?: "SMA50" | "SMA200" | "BOTH" | null;
}

function enrichFromHistory(
  symbol: string,
  name: string | undefined,
  marketCap: number | undefined,
  hist: Awaited<ReturnType<typeof fetchYahooHistory>>
): EnrichedCandidate {
  const sma50 = simpleMA(hist.closes, 50);
  const sma200 = simpleMA(hist.closes, 200);

  // 10-day average volume excluding today's partial session if we have enough history.
  const vols = hist.volumes.slice(-11, -1); // last 10 completed sessions
  const avgVol10d = avg(vols);
  const rvol = avgVol10d > 0 ? hist.todayVolume / avgVol10d : 0;

  const changePct = hist.prevClose ? ((hist.price - hist.prevClose) / hist.prevClose) * 100 : 0;

  // SMA bounce: price within smaBouncePct of either MA.
  const within = (a: number | undefined, b: number) =>
    a !== undefined && Math.abs((b - a) / a) <= CRITERIA.smaBouncePct;
  const near50 = within(sma50, hist.price);
  const near200 = within(sma200, hist.price);
  const smaBounce: EnrichedCandidate["smaBounce"] =
    near50 && near200 ? "BOTH" : near50 ? "SMA50" : near200 ? "SMA200" : null;

  let smaDistance: number | undefined;
  if (smaBounce) {
    const ma = smaBounce === "SMA200" ? sma200! : sma50!;
    smaDistance = Math.abs((hist.price - ma) / ma) * 100;
  }

  return {
    symbol,
    name,
    price: hist.price,
    prevClose: hist.prevClose,
    changePct,
    volume: hist.todayVolume,
    avgVol10d,
    rvol,
    marketCap,
    sma50,
    sma200,
    smaDistance,
    smaBounce,
  };
}

function scoreCandidate(c: EnrichedCandidate, float?: number): number {
  // Composite score: weights tuned to Mario's setup (MA bounce + RVOL + low float).
  // Higher = better.
  let score = 0;
  if (c.smaBounce) score += 3;
  if (c.smaBounce === "BOTH") score += 1;
  if (c.rvol >= 2) score += 2;
  else if (c.rvol >= 1.5) score += 1;
  if (float && float < 20_000_000) score += 2;
  if (float && float < 10_000_000) score += 1;
  if (float && float < 5_000_000) score += 1;
  if (Math.abs(c.changePct) >= 5) score += 1;
  if (Math.abs(c.changePct) >= 10) score += 1;
  return score;
}

function buildTags(c: EnrichedCandidate, float?: number): string[] {
  const tags: string[] = [];
  if (c.smaBounce === "BOTH") tags.push("50+200 BOUNCE");
  else if (c.smaBounce === "SMA50") tags.push("50 SMA BOUNCE");
  else if (c.smaBounce === "SMA200") tags.push("200 SMA BOUNCE");
  if (c.rvol >= 3) tags.push(`RVOL ${c.rvol.toFixed(1)}x`);
  else if (c.rvol >= 1.5) tags.push(`RVOL ${c.rvol.toFixed(1)}x`);
  if (float && float < 5_000_000) tags.push(`${(float / 1e6).toFixed(1)}M FLOAT`);
  else if (float && float < 20_000_000) tags.push(`${(float / 1e6).toFixed(1)}M FLOAT`);
  return tags;
}

export async function runScanner(): Promise<ScannerResult> {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  const degraded = !apiKey;
  const notes: string[] = [];
  if (degraded) {
    notes.push("FINNHUB_API_KEY not set — float filter disabled, showing momentum-only results");
  }

  // 1. Pull candidate pool from three Yahoo predefined screeners in parallel.
  //    most_actives = heavy volume, day_gainers/losers = biggest %-movers.
  let rawCandidates: YahooScreenerQuote[] = [];
  try {
    const pools = await Promise.all([
      fetchYahooScreener("most_actives", 100),
      fetchYahooScreener("day_gainers", 100),
      fetchYahooScreener("day_losers", 100),
    ]);
    // Dedupe by symbol (a stock can appear in multiple screens).
    const seen = new Set<string>();
    for (const quote of pools.flat()) {
      if (!quote.symbol || seen.has(quote.symbol)) continue;
      seen.add(quote.symbol);
      rawCandidates.push(quote);
    }
  } catch (err) {
    console.error("[scanner] yahoo screener fail:", err);
    notes.push("Yahoo screener unavailable — returning empty result");
    return emptyResult(degraded, notes, 0);
  }

  // 2. Pre-filter on data we already have: price range, has a ticker.
  const prefiltered = rawCandidates.filter((q) => {
    const price = q.regularMarketPrice ?? 0;
    return (
      !!q.symbol &&
      price >= CRITERIA.priceMin &&
      price <= CRITERIA.priceMax
    );
  });

  // 3. Rank pre-filtered by absolute change × volume (a rough momentum proxy)
  //    and cap at maxCandidates so we don't blow the Finnhub rate limit.
  const ranked = prefiltered
    .map((q) => ({
      q,
      momentum:
        Math.abs(q.regularMarketChangePercent ?? 0) *
        Math.log10(Math.max(1, q.regularMarketVolume ?? 0)),
    }))
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, CRITERIA.maxCandidates)
    .map((x) => x.q);

  // 4. Enrich each survivor: Yahoo history (for SMA + RVOL) in parallel,
  //    then optionally Finnhub float.
  const enrichedRaw = await Promise.all(
    ranked.map(async (q) => {
      try {
        const hist = await fetchYahooHistory(q.symbol!);
        return enrichFromHistory(
          q.symbol!,
          q.shortName ?? q.longName,
          q.marketCap,
          hist
        );
      } catch (err) {
        console.warn(`[scanner] history fail ${q.symbol}:`, err);
        return null;
      }
    })
  );
  const enriched = enrichedRaw.filter((e): e is EnrichedCandidate => e !== null);

  // 5. Floats (optional; sequential-ish with small batches to stay under rate limit).
  const floats = new Map<string, number | undefined>();
  if (apiKey) {
    // Finnhub free tier: 60/min. We're well under — but keep it tidy.
    const batches = chunk(enriched, 10);
    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (c) => {
          const profile = await fetchFinnhubProfile(c.symbol, apiKey);
          return [c.symbol, profile?.shareOutstanding] as const;
        })
      );
      for (const [sym, so] of results) {
        // Finnhub returns shareOutstanding in MILLIONS — convert to raw shares.
        floats.set(sym, so !== undefined ? so * 1_000_000 : undefined);
      }
    }
  }

  // 6. Final filter by Mario's criteria: SMA bounce required, RVOL >= 1.5,
  //    float < 20M (only if we have float data).
  const qualified: SetupCandidate[] = enriched
    .filter((c) => {
      if (!c.smaBounce) return false;
      if (c.rvol < CRITERIA.minRvol) return false;
      if (apiKey) {
        const f = floats.get(c.symbol);
        if (f === undefined || f === 0) return false; // need float data
        if (f > CRITERIA.maxFloat) return false;
      }
      return true;
    })
    .map((c) => {
      const float = floats.get(c.symbol);
      return {
        symbol: c.symbol,
        name: c.name,
        price: c.price,
        changePct: c.changePct,
        volume: c.volume,
        avgVol10d: c.avgVol10d,
        rvol: c.rvol,
        float,
        marketCap: c.marketCap,
        sma50: c.sma50,
        sma200: c.sma200,
        smaDistance: c.smaDistance,
        smaBounce: c.smaBounce,
        score: scoreCandidate(c, float),
        tags: buildTags(c, float),
      } satisfies SetupCandidate;
    });

  // 7. Split + rank.
  const longs = qualified
    .filter((c) => c.changePct >= 0)
    .sort((a, b) => b.score - a.score || b.changePct - a.changePct)
    .slice(0, 3);
  const shorts = qualified
    .filter((c) => c.changePct < 0)
    .sort((a, b) => b.score - a.score || a.changePct - b.changePct)
    .slice(0, 3);

  if (!longs.length && !shorts.length) {
    notes.push(
      "No setups matched all criteria today — try again near market open or after a volatile session"
    );
  }

  return {
    topLongs: longs,
    topShorts: shorts,
    scannedAt: new Date().toISOString(),
    candidateCount: rawCandidates.length,
    qualifiedCount: qualified.length,
    degraded,
    notes,
    criteria: {
      priceMin: CRITERIA.priceMin,
      priceMax: CRITERIA.priceMax,
      maxFloat: CRITERIA.maxFloat,
      minRvol: CRITERIA.minRvol,
      smaBouncePct: CRITERIA.smaBouncePct,
    },
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function emptyResult(degraded: boolean, notes: string[], candidateCount: number): ScannerResult {
  return {
    topLongs: [],
    topShorts: [],
    scannedAt: new Date().toISOString(),
    candidateCount,
    qualifiedCount: 0,
    degraded,
    notes,
    criteria: {
      priceMin: CRITERIA.priceMin,
      priceMax: CRITERIA.priceMax,
      maxFloat: CRITERIA.maxFloat,
      minRvol: CRITERIA.minRvol,
      smaBouncePct: CRITERIA.smaBouncePct,
    },
  };
}
