"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Brief, MarketData, Ticker } from "@/lib/types";
import { formatPct, formatPrice, formatTime, arrow } from "@/lib/format";
import TickerCard from "./TickerCard";
import FearGreedGauge from "./FearGreedGauge";
import SectorHeatmap from "./SectorHeatmap";
import MacroCalendar from "./MacroCalendar";
import DailyBrief from "./DailyBrief";
import Sparkline from "./Sparkline";
import RangeBar from "./RangeBar";
import UserWatchlist from "./UserWatchlist";

interface MarketDashboardProps {
  initialData: MarketData;
  brief: Brief;
}

export default function MarketDashboard({ initialData, brief }: MarketDashboardProps) {
  const [data, setData] = useState<MarketData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      {error && (
        <div className="border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-center font-mono text-[11px] text-red-400">
          Refresh failed: {error}. Showing last good data.
        </div>
      )}

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)]/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)] xs:text-[11px]">
              LIVE · {formatTime(data.updatedAt)}
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-md border border-[color:var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50 xs:px-2.5 xs:text-[10px] xs:tracking-[0.15em]"
            aria-label="Refresh market data"
          >
            {loading ? "…" : "↻"}
            <span className="ml-1 hidden xs:inline">
              {loading ? "Refreshing" : "Refresh"}
            </span>
          </button>
        </div>

        {/* Row 1: Brief + Fear & Greed (dual) */}
        <section className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DailyBrief brief={brief} market={data} />
          </div>
          <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <div className="flex w-full flex-col items-center gap-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Stock Market Fear &amp; Greed
              </div>
              <FearGreedGauge
                score={data.fearGreed.stock.score}
                label={data.fearGreed.stock.label}
                stale={data.fearGreed.stock.stale}
                maxSize={220}
              />
            </div>
            <div className="h-px w-full bg-[color:var(--border)]" />
            <div className="flex w-full flex-col items-center gap-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Crypto Fear &amp; Greed
              </div>
              <FearGreedGauge
                score={data.fearGreed.crypto.score}
                label={data.fearGreed.crypto.label}
                stale={data.fearGreed.crypto.stale}
                maxSize={220}
                compact
              />
            </div>
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

        {/* Row 3.5: User watchlist */}
        <UserWatchlist />

        {/* Row 4: Heatmap + Macro calendar */}
        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Sector Heatmap">
            <SectorHeatmap sectors={data.sectors} />
          </Panel>
          <Panel title="This Week's Macro Events">
            <MacroCalendar events={data.economicCalendar} />
          </Panel>
        </section>

        {/* Row 5: Scanner + Journal teasers */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Link
            href="/scanner"
            className="group block overflow-hidden rounded-xl border border-[color:var(--border)] bg-gradient-to-r from-[color:var(--surface)] to-[color:var(--surface)]/60 p-5 transition-colors hover:border-[color:var(--accent)]"
          >
            <div className="flex flex-col items-start gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                Day Trader Scanner
              </div>
              <h3 className="font-bebas text-2xl tracking-wide text-[color:var(--text)] xs:text-3xl">
                Today's top 3 long + short setups
              </h3>
              <p className="text-[13px] leading-relaxed text-[color:var(--muted)]">
                Small-cap setups: float &lt;20M, RVOL &gt;1.5x, bouncing off the
                50 or 200-day SMA. Updates every 5 min.
              </p>
              <span className="mt-1 rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black transition-opacity group-hover:opacity-90">
                Open scanner →
              </span>
            </div>
          </Link>

          <Link
            href="/journal"
            className="group block overflow-hidden rounded-xl border border-[color:var(--border)] bg-gradient-to-r from-[color:var(--surface)] to-[color:var(--surface)]/60 p-5 transition-colors hover:border-[color:var(--accent)]"
          >
            <div className="flex flex-col items-start gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                Public trading journal
              </div>
              <h3 className="font-bebas text-2xl tracking-wide text-[color:var(--text)] xs:text-3xl">
                Mario's live trade log
              </h3>
              <p className="text-[13px] leading-relaxed text-[color:var(--muted)]">
                Every trade, every setup, win rate and R-multiple. Fully public
                — watch the thesis, the exit, and the receipts.
              </p>
              <span className="mt-1 rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black transition-opacity group-hover:opacity-90">
                Open journal →
              </span>
            </div>
          </Link>
        </section>

        <footer className="border-t border-[color:var(--border)]/70 pt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Not financial advice. Do your own research. Sources: Yahoo Finance, CoinGecko, Finnhub, alternative.me
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
  const yahooHref = `https://finance.yahoo.com/quote/${encodeURIComponent(
    ticker.yahooSymbol ?? ticker.symbol
  )}`;
  return (
    <a
      href={yahooHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${ticker.name ?? ticker.symbol} — open on Yahoo Finance`}
      className="group flex items-center gap-2 rounded-md py-3 transition-colors hover:bg-[color:var(--surface-2)]/60 focus:bg-[color:var(--surface-2)] focus:outline-none xs:gap-3"
    >
      <div className="w-16 shrink-0 xs:w-20">
        <div className="truncate font-mono text-xs font-bold text-[color:var(--text)] group-hover:text-[color:var(--accent)]">
          {ticker.symbol}
        </div>
        <div className="truncate font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
          {ticker.name ?? ""}
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 md:block">
        <Sparkline data={ticker.history} up={up} height={36} className="w-full" />
      </div>
      <div className="hidden min-w-0 flex-1 sm:block">
        {showRange ? (
          <RangeBar low={ticker.low52} high={ticker.high52} current={ticker.price} />
        ) : (
          <div className="h-0" />
        )}
      </div>
      {/* On narrow screens where sparkline+range are hidden, show a compact sparkline instead */}
      <div className="min-w-0 flex-1 sm:hidden">
        <Sparkline data={ticker.history} up={up} height={32} className="w-full" />
      </div>
      <div className="w-[72px] shrink-0 text-right xs:w-[88px] sm:w-28">
        <div className="truncate font-mono text-[13px] font-semibold text-[color:var(--text)] xs:text-sm">
          {formatPrice(ticker.price)}
        </div>
        <div
          className="font-mono text-[10px] font-semibold"
          style={{ color: up ? "var(--up)" : "var(--down)" }}
        >
          {arrow(ticker.changePct)} {formatPct(ticker.changePct)}
        </div>
      </div>
    </a>
  );
}
