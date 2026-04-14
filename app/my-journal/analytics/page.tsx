import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { listUserTrades } from "@/lib/kv";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import EquityCurve from "@/components/EquityCurve";
import MonthlyPnl from "@/components/MonthlyPnl";
import TradeCalendar from "@/components/TradeCalendar";
import { SETUP_TYPE_LABELS, computeStats, computeTradeDerived } from "@/lib/journal";
import { formatPct, formatPrice } from "@/lib/format";
import type { Trade } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Analytics",
  description: "Your private trading performance analytics.",
  robots: { index: false, follow: false },
};

export default async function MyAnalyticsPage() {
  const email = await getUser();
  if (!email) redirect("/login");

  const raw = await listUserTrades(email, 500);
  const trades = raw.map(computeTradeDerived);
  const stats = computeStats(raw);
  const closed = trades.filter((t) => t.status === "closed");

  const bySetup = new Map<string, Trade[]>();
  for (const t of closed) {
    const arr = bySetup.get(t.setupType) ?? [];
    arr.push(t);
    bySetup.set(t.setupType, arr);
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav
        maxWidth="max-w-[1000px]"
        links={[{ href: "/my-journal", label: "← My Journal" }]}
      />
      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-10 xs:py-12">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            🔒 Private · {email}
          </div>
          <h1 className="font-bebas text-[40px] leading-none tracking-wide xs:text-5xl">
            My analytics
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)]">
            Your own performance breakdown. Wait for 50+ closed trades before trusting these numbers.
          </p>
        </div>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-3 xs:grid-cols-3 sm:grid-cols-4">
          <Card label="Closed" value={stats.closedTrades} />
          <Card label="Win rate" value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "—"} />
          <Card label="Total P&L" value={stats.closedTrades > 0 ? formatPrice(stats.totalPnl) : "—"} kind={stats.totalPnl > 0 ? "up" : stats.totalPnl < 0 ? "down" : undefined} />
          <Card label="Expectancy" value={stats.closedTrades > 0 ? formatPrice(stats.expectancy) : "—"} sub="per trade" kind={stats.expectancy > 0 ? "up" : stats.expectancy < 0 ? "down" : undefined} />
          <Card label="Avg win" value={stats.wins > 0 ? formatPrice(stats.avgWin) : "—"} kind="up" />
          <Card label="Avg loss" value={stats.losses > 0 ? formatPrice(stats.avgLoss) : "—"} kind="down" />
          <Card label="Avg R" value={stats.avgRMultiple !== undefined ? stats.avgRMultiple.toFixed(2) + "R" : "—"} />
          <Card label="Win:Loss" value={stats.avgLoss !== 0 ? Math.abs(stats.avgWin / stats.avgLoss).toFixed(2) : "—"} />
        </section>

        {/* Charts */}
        <section>
          <EquityCurve trades={raw} />
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <MonthlyPnl trades={raw} />
          <TradeCalendar trades={raw} weeks={26} />
        </section>

        {/* Best / Worst */}
        {(stats.bestTrade || stats.worstTrade) && (
          <section className="grid gap-4 lg:grid-cols-2">
            {stats.bestTrade && <TradeHighlight trade={stats.bestTrade} label="Best trade" kind="up" />}
            {stats.worstTrade && <TradeHighlight trade={stats.worstTrade} label="Worst trade" kind="down" />}
          </section>
        )}

        {/* By setup */}
        {bySetup.size > 0 && (
          <section>
            <h2 className="mb-3 font-bebas text-2xl tracking-wide xs:text-3xl">By setup type</h2>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              <div className="grid grid-cols-12 gap-2 border-b border-[color:var(--border)] pb-2 font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
                <div className="col-span-4">Setup</div>
                <div className="col-span-2 text-right">N</div>
                <div className="col-span-2 text-right">Win %</div>
                <div className="col-span-2 text-right">Avg R</div>
                <div className="col-span-2 text-right">P&L</div>
              </div>
              {Array.from(bySetup.entries()).map(([setup, setTrades]) => {
                const s = computeStats(setTrades);
                return (
                  <div key={setup} className="grid grid-cols-12 gap-2 border-b border-[color:var(--border)]/50 py-2.5 font-mono text-[12px] last:border-0">
                    <div className="col-span-4 truncate text-[color:var(--text)]">{SETUP_TYPE_LABELS[setup] ?? setup}</div>
                    <div className="col-span-2 text-right text-[color:var(--muted)]">{s.closedTrades}</div>
                    <div className="col-span-2 text-right">{s.winRate.toFixed(0)}%</div>
                    <div className="col-span-2 text-right">{s.avgRMultiple !== undefined ? s.avgRMultiple.toFixed(2) : "—"}</div>
                    <div className="col-span-2 text-right font-semibold" style={{ color: s.totalPnl > 0 ? "var(--up)" : s.totalPnl < 0 ? "var(--down)" : "var(--text)" }}>
                      {s.totalPnl > 0 ? "+" : ""}{formatPrice(s.totalPnl)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {stats.totalTrades === 0 && (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-10 text-center">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">No closed trades yet</div>
            <p className="mt-2 text-[13px] text-[color:var(--muted)]">Analytics populate as you log and close trades.</p>
          </div>
        )}

        <SiteFooter minimal />
      </main>
    </div>
  );
}

function Card({ label, value, sub, kind }: { label: string; value: string | number; sub?: string; kind?: "up" | "down" }) {
  const color = kind === "up" ? "var(--up)" : kind === "down" ? "var(--down)" : "var(--text)";
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 xs:p-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)] xs:text-[10px]">{label}</div>
      <div className="mt-1 font-bebas text-2xl leading-none xs:text-3xl" style={{ color }}>{value}</div>
      {sub && <div className="mt-1 font-mono text-[9px] text-[color:var(--muted)] xs:text-[10px]">{sub}</div>}
    </div>
  );
}

function TradeHighlight({ trade, label, kind }: { trade: Trade; label: string; kind: "up" | "down" }) {
  const color = kind === "up" ? "var(--up)" : "var(--down)";
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color }}>{label}</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-bebas text-3xl leading-none tracking-wide">{trade.symbol}</span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">{trade.side} · {SETUP_TYPE_LABELS[trade.setupType] ?? trade.setupType}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-4">
        <span className="font-bebas text-4xl leading-none" style={{ color }}>{(trade.pnl ?? 0) >= 0 ? "+" : ""}{formatPrice(trade.pnl ?? 0)}</span>
        <span className="font-mono text-[12px]" style={{ color }}>
          {formatPct(trade.pnlPct ?? 0)}
          {trade.rMultiple !== undefined && <span className="ml-2">{trade.rMultiple.toFixed(2)}R</span>}
        </span>
      </div>
    </div>
  );
}
