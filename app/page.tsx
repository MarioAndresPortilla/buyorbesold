import Link from "next/link";
import { fetchAllMarkets } from "@/lib/markets";
import { getLatestBrief } from "@/lib/briefs";
import { arrow, formatPct, formatPrice } from "@/lib/format";
import DailyBrief from "@/components/DailyBrief";
import FearGreedGauge from "@/components/FearGreedGauge";
import NewsletterSignup from "@/components/NewsletterSignup";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import Sparkline from "@/components/Sparkline";
import type { Ticker } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const [market, brief] = await Promise.all([
    fetchAllMarkets(),
    Promise.resolve(getLatestBrief()),
  ]);

  const snapshot: Array<{ ticker: Ticker; label: string }> = [
    { ticker: market.sp500, label: "S&P 500" },
    { ticker: market.bitcoin, label: "Bitcoin" },
    { ticker: market.gold, label: "Gold" },
    { ticker: market.silver, label: "Silver" },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav />

      {/* Hero */}
      <section className="border-b border-[color:var(--border)]">
        <div className="mx-auto max-w-[1200px] px-4 py-12 text-center xs:py-16 sm:py-24">
          <span className="inline-block rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Daily Market Brief
          </span>
          <h1 className="mt-6 font-bebas text-[44px] leading-[0.95] tracking-wide text-[color:var(--text)] xs:text-5xl sm:text-7xl md:text-[96px]">
            Markets. Bullion.
            <br />
            Bitcoin. <span className="text-[color:var(--accent)]">No noise.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-[color:var(--muted)] sm:text-lg">
            One brief each weekday. S&amp;P 500, gold, silver, bitcoin, commodities, and the
            macro that moves them — with my personal take. No pumping, no affiliate spam.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 xs:flex-row xs:items-center xs:flex-wrap">
            <Link
              href="/dashboard"
              className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-5 py-3 text-center font-mono text-xs font-bold uppercase tracking-[0.15em] text-black hover:opacity-90"
            >
              See full dashboard →
            </Link>
            <Link
              href="/newsletter"
              className="rounded-md border border-[color:var(--border)] px-5 py-3 text-center font-mono text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--text)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              Get the daily brief →
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1200px] space-y-10 px-4 py-12">
        {/* Snapshot row */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-bebas text-2xl tracking-wide">Today's snapshot</h2>
            <Link
              href="/dashboard"
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--accent)] hover:underline"
            >
              Full dashboard →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {snapshot.map(({ ticker, label }) => {
              const up = ticker.changePct >= 0;
              return (
                <div
                  key={ticker.symbol}
                  className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-[3px]"
                    style={{ background: up ? "var(--up)" : "var(--down)" }}
                    aria-hidden
                  />
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    {label}
                  </div>
                  <div className="mt-1 font-bebas text-3xl leading-none">
                    {formatPrice(ticker.price)}
                  </div>
                  <div
                    className="mt-1 font-mono text-xs font-semibold"
                    style={{ color: up ? "var(--up)" : "var(--down)" }}
                  >
                    {arrow(ticker.changePct)} {formatPct(ticker.changePct)}
                  </div>
                  <div className="mt-3">
                    <Sparkline data={ticker.history} up={up} width={240} height={40} className="w-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Brief + Fear & Greed (dual) */}
        <section className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DailyBrief brief={brief} market={market} />
          </div>
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <div className="flex w-full flex-col items-center gap-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Stock Market Fear &amp; Greed
              </div>
              <FearGreedGauge
                score={market.fearGreed.stock.score}
                label={market.fearGreed.stock.label}
                stale={market.fearGreed.stock.stale}
                maxSize={200}
                compact
              />
            </div>
            <div className="h-px w-full bg-[color:var(--border)]" />
            <div className="flex w-full flex-col items-center gap-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Crypto Fear &amp; Greed
              </div>
              <FearGreedGauge
                score={market.fearGreed.crypto.score}
                label={market.fearGreed.crypto.label}
                stale={market.fearGreed.crypto.stale}
                maxSize={200}
                compact
              />
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <NewsletterSignup />
          </div>
          <div className="lg:col-span-2 flex flex-col justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <h3 className="font-bebas text-2xl tracking-wide">What you get</h3>
            <ul className="mt-3 space-y-2 font-mono text-[12px] text-[color:var(--muted)]">
              <li>· 3 AI briefs per day (9am · 12pm · 4pm)</li>
              <li>· Stocks, bullion, crypto, macro</li>
              <li>· My personal take — no fluff</li>
              <li>· Unsubscribe any time</li>
            </ul>
          </div>
        </section>

        {/* Trading journal CTA */}
        <section>
          <Link
            href="/login"
            className="group block overflow-hidden rounded-xl border border-[color:var(--border)] bg-gradient-to-r from-[color:var(--surface)] to-[color:var(--accent)]/5 p-6 transition-colors hover:border-[color:var(--accent)]"
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                  Free · No credit card
                </div>
                <h3 className="font-bebas text-3xl tracking-wide text-[color:var(--text)]">
                  Track your own trades
                </h3>
                <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[color:var(--muted)]">
                  Private trading journal with win rate analytics, R-multiple tracking,
                  and setup breakdowns. Sign up with just your email — no password, no forms.
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-opacity group-hover:opacity-90">
                Start free →
              </span>
            </div>
          </Link>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
