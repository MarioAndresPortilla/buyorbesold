import { fetchYahoo } from "./markets";
import type { Sector } from "./types";

/**
 * Sector detail helper: for each sector code, a curated list of top
 * holdings (the kind of names readers actually look at), plus the ETF
 * symbol and display name. Clicking a tile on the heatmap loads a page
 * that fetches these tickers live and ranks by day change so the user
 * sees who's hot / cold / sitting on a setup inside the sector.
 *
 * Kept in code (not JSON) so the list stays version-controlled and can
 * be pruned without a redeploy cycle from the content editor.
 */

export interface SectorMeta {
  code: string;
  symbol: string; // SPDR ETF proxy
  name: string;
  blurb: string;
  tickers: string[];
}

export const SECTORS: SectorMeta[] = [
  {
    code: "tech",
    symbol: "XLK",
    name: "Technology",
    blurb:
      "Semis, software, hardware, cloud. The beta sleeve of the S&P — rates reaction matters more than earnings on any given day.",
    tickers: [
      "AAPL", "MSFT", "NVDA", "AVGO", "META", "GOOGL", "AMD", "CRM",
      "ORCL", "CSCO", "QCOM", "ADBE", "INTC", "TXN", "AMAT", "PANW",
    ],
  },
  {
    code: "energy",
    symbol: "XLE",
    name: "Energy",
    blurb:
      "Integrated majors, E&P, services. Trades crude first, dollar second, geopolitics third.",
    tickers: [
      "XOM", "CVX", "COP", "EOG", "SLB", "PSX", "MPC", "OXY",
      "VLO", "WMB", "KMI", "HES", "DVN", "HAL", "FANG",
    ],
  },
  {
    code: "finance",
    symbol: "XLF",
    name: "Financials",
    blurb:
      "Money-center banks, insurers, card networks, asset managers. Yield curve is the gravity well.",
    tickers: [
      "BRK-B", "JPM", "V", "MA", "BAC", "WFC", "MS", "GS",
      "AXP", "C", "SCHW", "BLK", "PGR", "SPGI", "BX",
    ],
  },
  {
    code: "health",
    symbol: "XLV",
    name: "Healthcare",
    blurb:
      "Pharma, devices, payers, tools. Defensive earnings but headline-sensitive (FDA, political cycles).",
    tickers: [
      "LLY", "JNJ", "UNH", "ABBV", "MRK", "PFE", "TMO", "ABT",
      "ISRG", "AMGN", "DHR", "SYK", "GILD", "BMY", "VRTX",
    ],
  },
  {
    code: "consum",
    symbol: "XLY",
    name: "Consumer Discretionary",
    blurb:
      "Retail, autos, travel, restaurants. Reads consumer health and the wealth effect tape.",
    tickers: [
      "AMZN", "TSLA", "HD", "MCD", "LOW", "NKE", "SBUX", "TJX",
      "BKNG", "ROST", "GM", "MAR", "ORLY", "AZO", "ULTA",
    ],
  },
  {
    code: "indust",
    symbol: "XLI",
    name: "Industrials",
    blurb:
      "Machinery, aerospace, rail, logistics. Cyclically sensitive to PMI + capex cycles.",
    tickers: [
      "CAT", "GE", "RTX", "HON", "UNP", "BA", "DE", "LMT",
      "UPS", "ADP", "ETN", "NSC", "CSX", "ITW", "WM",
    ],
  },
  {
    code: "util",
    symbol: "XLU",
    name: "Utilities",
    blurb:
      "Regulated + IPP. Bond proxy — trades off the 10Y more than any earnings print.",
    tickers: [
      "NEE", "SO", "DUK", "AEP", "SRE", "XEL", "D", "EXC",
      "PCG", "ED", "CEG", "PEG", "EIX", "WEC", "AWK",
    ],
  },
  {
    code: "reit",
    symbol: "XLRE",
    name: "Real Estate",
    blurb:
      "REITs across data centers, industrials, retail, towers, residential. Duration-sensitive; cap rates follow rates.",
    tickers: [
      "PLD", "AMT", "EQIX", "WELL", "PSA", "SPG", "CCI", "DLR",
      "O", "EXR", "AVB", "VICI", "SBAC", "EQR", "ARE",
    ],
  },
  {
    code: "mats",
    symbol: "XLB",
    name: "Materials",
    blurb:
      "Specialty chemicals, metals, packaging, mining. Reads global growth and dollar direction.",
    tickers: [
      "LIN", "SHW", "APD", "ECL", "FCX", "NEM", "DOW", "DD",
      "CTVA", "PPG", "NUE", "VMC", "MLM", "PKG", "IP",
    ],
  },
  {
    code: "comms",
    symbol: "XLC",
    name: "Communication Services",
    blurb:
      "Mega-cap platforms, telco, media, gaming. Driven by ad cycle + content / subscription economics.",
    tickers: [
      "META", "GOOGL", "GOOG", "NFLX", "DIS", "VZ", "T", "TMUS",
      "CMCSA", "CHTR", "EA", "TTWO", "WBD", "LYV", "PARA",
    ],
  },
];

export function getSectorMeta(code: string): SectorMeta | undefined {
  const norm = code.trim().toLowerCase();
  return SECTORS.find((s) => s.code === norm);
}

export interface SectorMoverRow {
  symbol: string;
  name?: string;
  price: number;
  changePct: number;
  /** Where the price is inside the 52-week range, 0..1. */
  rangePos: number | null;
}

export interface SectorBreakdown {
  meta: SectorMeta;
  /** Day % change of the sector ETF itself. */
  sectorChange: Sector | null;
  rows: SectorMoverRow[];
  scannedAt: string;
}

/**
 * Fetch live intraday data for every ticker in a sector's curated list.
 * Rows with bad/missing data are dropped so we don't render $0 prices.
 */
export async function fetchSectorBreakdown(
  code: string
): Promise<SectorBreakdown | null> {
  const meta = getSectorMeta(code);
  if (!meta) return null;

  const [etf, ...rows] = await Promise.all([
    fetchYahoo(meta.symbol, meta.symbol, meta.name).catch(() => null),
    ...meta.tickers.map((t) =>
      fetchYahoo(t, t).catch((err) => {
        console.warn(`[sectors] ${meta.code} ${t} fail:`, err);
        return null;
      })
    ),
  ]);

  const cleaned: SectorMoverRow[] = rows
    .filter((t): t is NonNullable<typeof t> => !!t && t.price > 0)
    .map((t) => {
      const range = t.high52 - t.low52;
      const rangePos =
        range > 0 ? Math.max(0, Math.min(1, (t.price - t.low52) / range)) : null;
      return {
        symbol: t.symbol,
        name: t.name,
        price: t.price,
        changePct: t.changePct,
        rangePos,
      };
    })
    .sort((a, b) => b.changePct - a.changePct);

  return {
    meta,
    sectorChange: etf
      ? { code: meta.code.toUpperCase(), name: meta.name, changePct: etf.changePct }
      : null,
    rows: cleaned,
    scannedAt: new Date().toISOString(),
  };
}
