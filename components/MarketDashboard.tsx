"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Brief, MarketData, Ticker } from "@/lib/types";
import { formatPct, formatPrice, formatTime, arrow } from "@/lib/format";
import TickerCard from "./TickerCard";
import TickerTape from "./TickerTape";
import FearGreedGauge from "./FearGreedGauge";
import SectorHeatmap from "./SectorHeatmap";
import MacroCalendar from "./MacroCalendar";
import DailyBrief from "./DailyBrief";
import Sparkline from "./Sparkline";
import RangeBar from "./RangeBar";

interface MarketDashboardProps {
  initialData: MarketData;
  brief: Brief;
}

type Theme = "dark" | "light";

const THEME_KEY = "bobs-theme";

export default function MarketDashboard({ initialData, brief }: MarketDashboardProps) {
  const [data, setData] = useState<MarketData>(initialData);
  const [theme, setTheme] = useState<Theme>("dark");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load persisted theme on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as Theme | null;
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply theme to <body> so CSS variables flip site-wide.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/markets", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as MarketData;
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "refresh failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 60s.
  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const tapeTickers: Ticker[] = [
    data.sp500,
    data.bitcoin,
    data.gold,
    data.silver,
    data.crude,
    data.natgas,
    data.copper,
    data.qqq,
    data.voo,
    data.vti,
    data.dia,
    data.dxy,
    data.tnx,
  ];

  const mainTickers: Array<{ ticker: Ticker; label: string }> = [
    { ticker: data.sp500, label: "S&P 500" },
    { ticker: data.bitcoin, label: "Bitcoin" },
    { ticker: data.gold, label: "Gold" },
    { ticker: data.silver, label: "Silver" },
    { ticker: data.crude, label: "Crude Oil" },
  ];

  const indexFunds: Ticker[] = [data.qqq, data.voo, data.vti, data.dia];
  const commodities: Ticker[] = [data.natgas, data.copper, data.gold, data.silver];

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-lg tracking-wider text-[color:var(--accent)]">
              B/S
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-bebas text-xl tracking-wider text-[color:var(--text)]">
                BUYORBESOLD
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Markets · Bullion · Bitcoin
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
                LIVE · {formatTime(data.updatedAt)}
              </span>
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-md border border-[color:var(--border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md border border-[color:var(--border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? "☀ Light" : "☾ Dark"}
            </button>
          </div>
        </div>
        <TickerTape tickers={tapeTickers} />
      </header>

      {error && (
        <div className="border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-center font-mono text-[11px] text-red-400">
          Refresh failed: {error}. Showing last good data.
        </div>
      )}

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        {/* Row 1: Brief + Fear & Greed */}
        <section className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DailyBrief brief={brief} market={data} />
          </div>
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Fear &amp; Greed Index
            </div>
            <FearGreedGauge score={data.fearGreed.score} label={data.fearGreed.label} />
          </div>
        </section>

        {/* Row 2: Main tickers */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {mainTickers.map(({ ticker, label }) => (
            <TickerCard key={ticker.symbol} ticker={ticker} label={label} />
          ))}
        </section>

        {/* Row 3: Index funds + Commodities */}
        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Index Funds">
            <div className="divide-y divide-[color:var(--border)]/70">
              {indexFunds.map((t) => (
                <TickerRow key={t.symbol} ticker={t} />
              ))}
            </div>
          </Panel>

          <Panel title="Commodities">
            <div className="divide-y divide-[color:var(--border)]/70">
              {commodities.map((t) => (
                <TickerRow key={`cmty-${t.symbol}`} ticker={t} showRange />
              ))}
            </div>
          </Panel>
        </section>

        {/* Row 4: Heatmap + Macro calendar */}
        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Sector Heatmap">
            <SectorHeatmap jitter />
          </Panel>
          <Panel title="This Week's Macro Events">
            <MacroCalendar />
          </Panel>
        </section>

        <footer className="border-t border-[color:var(--border)]/70 pt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Not financial advice. Do your own research. Data cached 60s · sources: Yahoo Finance, CoinGecko, alternative.me
        </footer>
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bebas text-xl tracking-wide text-[color:var(--text)]">
          {title}
        </h3>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          LIVE
        </span>
      </div>
      {children}
    </div>
  );
}

function TickerRow({ ticker, showRange = false }: { ticker: Ticker; showRange?: boolean }) {
  const up = ticker.changePct >= 0;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-20 shrink-0">
        <div className="font-mono text-xs font-bold text-[color:var(--text)]">
          {ticker.symbol}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
          {ticker.name ?? ""}
        </div>
      </div>
      <div className="hidden flex-1 sm:block">
        <Sparkline data={ticker.history} up={up} width={180} height={36} className="w-full" />
      </div>
      <div className="flex-1">
        {showRange ? (
          <RangeBar low={ticker.low52} high={ticker.high52} current={ticker.price} />
        ) : (
          <div className="h-0" />
        )}
      </div>
      <div className="w-28 shrink-0 text-right">
        <div className="font-mono text-sm font-semibold text-[color:var(--text)]">
          {formatPrice(ticker.price)}
        </div>
        <div
          className="font-mono text-[10px] font-semibold"
          style={{ color: up ? "var(--up)" : "var(--down)" }}
        >
          {arrow(ticker.changePct)} {formatPct(ticker.changePct)}
        </div>
      </div>
    </div>
  );
}
