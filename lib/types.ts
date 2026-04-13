export interface Ticker {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePct: number;
  low52: number;
  high52: number;
  volume?: string;
  mktcap?: number;
  history?: number[];
}

export interface FearGreed {
  score: number;
  label: string;
}

export interface MarketData {
  sp500: Ticker;
  bitcoin: Ticker;
  gold: Ticker;
  silver: Ticker;
  platinum: Ticker;
  crude: Ticker;
  natgas: Ticker;
  copper: Ticker;
  qqq: Ticker;
  voo: Ticker;
  vti: Ticker;
  dia: Ticker;
  dxy: Ticker;
  tnx: Ticker;
  sectors: Sector[];
  fearGreed: FearGreed;
  updatedAt: string;
}

export interface Sector {
  code: string;
  name: string;
  changePct: number;
}

export interface MacroEvent {
  day: string;
  time: string;
  name: string;
  previous?: string;
  estimate?: string;
  impact: "HIGH" | "MED" | "LOW";
}

export type BriefType = "brief" | "earnings" | "event" | "setup" | "macro";

/**
 * Frontmatter fields specific to `type: earnings` briefs.
 * All fields are optional — the parser in lib/briefs.ts dumps whatever is
 * present in frontmatter into `meta`, and the [slug] page renders a card
 * from whatever fields are defined.
 */
export interface EarningsMeta {
  ticker?: string;
  quarter?: string;
  epsActual?: number;
  epsEst?: number;
  revActual?: number;
  revEst?: number;
  keyLevels?: number[];
}

/** Frontmatter for `type: event` briefs (CPI, FOMC, NFP, PCE, ISM, etc.). */
export interface EventMeta {
  event?: string;
  consensus?: string;
  actual?: string;
}

/** Frontmatter for `type: setup` briefs (Sunday Setup of the Week). */
export interface SetupMeta {
  symbol?: string;
  catalyst?: string;
  entry?: number;
  stop?: number;
  target?: number;
  rMultiple?: number;
}

/** Frontmatter for `type: macro` briefs (twice-monthly deep macro pieces). */
export interface MacroMeta {
  chart?: string;
  dataAsOf?: string;
}

/**
 * Type-specific structured metadata from brief frontmatter. The parser in
 * lib/briefs.ts dumps anything that isn't a reserved key (title, date,
 * summary, tags, type) into this object, so new fields can be added without
 * touching the parser. Render-time code narrows by `brief.type`.
 */
export type BriefMeta =
  | EarningsMeta
  | EventMeta
  | SetupMeta
  | MacroMeta
  | Record<string, unknown>;

export interface Brief {
  slug: string;
  date: string;
  title: string;
  summary: string;
  take: string;
  tags: string[];
  /** Content type. Absence defaults to "brief" for backward compatibility. */
  type?: BriefType;
  /** Type-specific structured fields from frontmatter. */
  meta?: BriefMeta;
}

export interface NewsItem {
  headline: string;
  url: string;
  source?: string;
  datetime: string;
  /** ISO string 24h ago or earlier = not fresh. */
  fresh: boolean;
}

export interface SetupCandidate {
  symbol: string;
  name?: string;
  price: number;
  changePct: number;
  volume: number;
  avgVol10d: number;
  rvol: number;
  float?: number;
  marketCap?: number;
  sma50?: number;
  sma200?: number;
  /** Absolute % distance from the nearest qualifying MA (50 or 200). */
  smaDistance?: number;
  /** Which MA the price is bouncing from. */
  smaBounce?: "SMA50" | "SMA200" | "BOTH" | null;
  score: number;
  /** Reasons this survived the filter — used as UI chips. */
  tags: string[];
  /** Most recent headline (if Finnhub is configured). */
  latestNews?: NewsItem;
}

export interface WatchlistItem {
  symbol: string;
  note?: string;
}

export interface WatchlistEntry {
  symbol: string;
  name?: string;
  note?: string;
  price: number;
  changePct: number;
  rvol: number;
  sma50?: number;
  sma200?: number;
  /** 0 = at MA, 100 = 100% away. Signed (+ above MA, - below). */
  sma50Delta?: number;
  sma200Delta?: number;
}

// ---- Trading journal ----

export type TradeSide = "long" | "short";
export type TradeStatus = "open" | "closed";
export type TradeOutcome = "win" | "loss" | "breakeven";
export type SetupType = "sma-bounce" | "breakout" | "catalyst" | "reversal" | "other";

export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  setupType: SetupType;
  entryDate: string; // ISO
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  size: number;
  stop?: number;
  target?: number;
  thesis: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;

  // Derived — computed at read time, not stored.
  status?: TradeStatus;
  outcome?: TradeOutcome;
  pnl?: number;
  pnlPct?: number;
  rMultiple?: number;
}

export interface TradeInput {
  symbol: string;
  side: TradeSide;
  setupType: SetupType;
  entryDate: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  size: number;
  stop?: number;
  target?: number;
  thesis: string;
  tags?: string[];
}

export interface JournalStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number; // avg PnL per trade
  avgRMultiple?: number;
  bestTrade?: Trade;
  worstTrade?: Trade;
}

export interface SessionClaims {
  sub: string; // email
  iat: number;
  exp: number;
}

export interface ScannerResult {
  topLongs: SetupCandidate[];
  topShorts: SetupCandidate[];
  scannedAt: string;
  /** How many tickers were inspected before filtering. */
  candidateCount: number;
  /** How many passed the criteria. */
  qualifiedCount: number;
  /** True when FINNHUB_API_KEY is missing; scanner runs in a degraded mode. */
  degraded: boolean;
  /** Human-readable status or warnings (rate limits, missing data, etc). */
  notes: string[];
  /** The criteria that were applied — displayed in the UI so viewers know the rules. */
  criteria: {
    priceMin: number;
    priceMax: number;
    maxFloat: number;
    minRvol: number;
    smaBouncePct: number;
  };
}
