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

export interface Brief {
  slug: string;
  date: string;
  title: string;
  summary: string;
  take: string;
  tags: string[];
}
