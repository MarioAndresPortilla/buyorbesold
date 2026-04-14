import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { isKvAvailable, listTrades } from "@/lib/kv";
import {
  SETUP_TYPE_LABELS,
  computeStats,
  computeTradeDerived,
  getDailyTopMovers,
} from "@/lib/journal";
import { arrow, formatPct, formatPrice } from "@/lib/format";
import type { Trade } from "@/lib/types";
import LogoutButton from "@/components/LogoutButton";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import EquityCurve from "@/components/EquityCurve";
import TradeCalendar from "@/components/TradeCalendar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trading Journal",
  description:
    "Mario's public trading journal: every trade, every setup, win rate and R-multiple. Not financial advice.",
  alternates: { canonical: "/journal" },
  openGraph: {
    title: "Trading Journal — BuyOrBeSold",
    description:
      "Live public trading journal. Every entry, every exit, every R.",
    type: "website",
  },
};

interface PageProps {
  searchParams: Promise<{ welcome?: string }>;
}

export default async function JournalPage({ searchParams }: PageProps) {
  const [rawTrades, admin, sp] = await Promise.all([listTrades(200), isAdmin(), searchParams]);
  const trades = rawTrades.map(computeTradeDerived);
  const stats = computeStats(rawTrades);
  const todayTop = getDailyTopMovers(rawTrades);
  const kvOn = isKvAvailable();
  const welcome = sp.welcome === "1" && admin;

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav
        maxWidth="max-w-[1100px]"
        links={[
          { href: "/dashboard", label: "Dashboard", short: "Dash" },
          { href: "/scanner", label: "Scanner" },
          { href: "/journal/analytics", label: "Stats" },
        ]}
        trailing={
          admin ? (
            <LogoutButton />
          ) : (
            <Link
              href="/login"
              className="hidden hover:text-[color:var(--accent)] xs:inline"
            >
              Admin
            </Link>
          )
        }
      />

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 xs:py-10">
        {welcome && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-[11px] text-emerald-400">
            ✓ Signed in. You can now log new trades.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
              Public trading journal
            </div>
            <h1 className="font-bebas text-[44px] leading-none tracking-wide xs:text-5xl sm:text-6xl">
              Trading journal
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)] xs:text-[14px]">
              Every trade I take gets logged here, with the thesis and the
              setup, win or lose. Not advice — read what you see, do your own
              work.
            </p>
          </div>
          {admin && (
            <Link
              href="/journal/new"
              className="inline-flex items-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90"
            >
              + Log new trade
            </Link>
          )}
        </div>

        {/* KV warning */}
        {!kvOn && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 font-mono text-[12px] text-amber-400">
            <div className="font-bold uppercase tracking-wider">
              Journal requires Vercel KV
            </div>
            <div className="mt-1 text-[11px] leading-relaxed">
              The journal reads and writes from Vercel KV. Provision a KV store
              in your Vercel project (Storage → Create → KV) and redeploy.
              Auth + writes will be ready immediately.
            </div>
          </div>
        )}

        {/* Stats strip */}
        <section className="grid grid-cols-2 gap-3 xs:grid-cols-4">
          <StatCard label="Total trades" value={stats.totalTrades} />
          <StatCard
            label="Win rate"
            value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "—"}
            sub={`${stats.wins}W / ${stats.losses}L`}
          />
          <StatCard
            label="Total P&L"
            value={stats.closedTrades > 0 ? formatPrice(stats.totalPnl) : "—"}
            sub={stats.closedTrades > 0 ? formatPct(stats.totalPnlPct) + " on cost" : undefined}
            kind={stats.totalPnl > 0 ? "up" : stats.totalPnl < 0 ? "down" : undefined}
          />
          <StatCard
            label="Avg R"
            value={stats.avgRMultiple !== undefined ? stats.avgRMultiple.toFixed(2) + "R" : "—"}
            sub={stats.expectancy ? `${formatPrice(stats.expectancy)}/trade` : undefined}
          />
        </section>

        {/* Charts: equity curve + activity heatmap */}
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <EquityCurve trades={rawTrades} />
          </div>
          <div className="lg:col-span-2">
            <TradeCalendar trades={rawTrades} weeks={18} />
          </div>
        </section>

        {/* Today's top movers */}
        {(todayTop.best.length > 0 || todayTop.worst.length > 0) && (
          <section className="grid gap-4 lg:grid-cols-2">
            <TopPanel title="Top 3 winners today" trades={todayTop.best} kind="up" />
            <TopPanel title="Top 3 losers today" trades={todayTop.worst} kind="down" />
          </section>
        )}

        {/* All trades */}
        <section>
          <h2 className="mb-3 font-bebas text-2xl tracking-wide xs:text-3xl">
            Recent trades
          </h2>
          {trades.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-10 text-center">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                No trades yet
              </div>
              <div className="mt-2 text-[13px] text-[color:var(--muted)]">
                {admin
                  ? "Hit the button above to log your first trade."
                  : "Mario hasn't logged any trades here yet. Check back soon."}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {trades.map((t) => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </div>
          )}
        </section>

        <SiteFooter minimal />
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  kind,
}: {
  label: string;
  value: string | number;
  sub?: string;
  kind?: "up" | "down";
}) {
  const color =
    kind === "up" ? "var(--up)" : kind === "down" ? "var(--down)" : "var(--text)";
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {label}
      </div>
      <div className="mt-1 font-bebas text-3xl leading-none" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-[color:var(--muted)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function TopPanel({
  title,
  trades,
  kind,
}: {
  title: string;
  trades: Trade[];
  kind: "up" | "down";
}) {
  const color = kind === "up" ? "var(--up)" : "var(--down)";
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
        {title}
      </h3>
      <div className="mt-3 space-y-2">
        {trades.length === 0 ? (
          <div className="font-mono text-[11px] text-[color:var(--muted)]">—</div>
        ) : (
          trades.map((t, i) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 font-mono text-[12px]">
              <span className="text-[color:var(--muted)]">#{i + 1}</span>
              <span className="font-bebas text-lg leading-none tracking-wide" style={{ color }}>
                {t.symbol}
              </span>
              <span className="flex-1 truncate text-right text-[color:var(--muted)]">
                {SETUP_TYPE_LABELS[t.setupType] ?? t.setupType}
              </span>
              <span style={{ color }} className="font-semibold">
                {(t.pnl ?? 0) >= 0 ? "+" : ""}
                {formatPrice(t.pnl ?? 0)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const sideColor = trade.side === "long" ? "var(--up)" : "var(--down)";
  const outcomeColor =
    trade.outcome === "win"
      ? "var(--up)"
      : trade.outcome === "loss"
        ? "var(--down)"
        : "var(--muted)";
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: sideColor }} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bebas text-2xl leading-none tracking-wide text-[color:var(--text)]">
              {trade.symbol}
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
              style={{
                color: sideColor,
                background: `color-mix(in oklab, ${sideColor} 14%, transparent)`,
              }}
            >
              {trade.side}
            </span>
            <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
              {SETUP_TYPE_LABELS[trade.setupType] ?? trade.setupType}
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
            Entered {new Date(trade.entryDate).toLocaleDateString("en-US")}
            {trade.exitDate && ` · Exited ${new Date(trade.exitDate).toLocaleDateString("en-US")}`}
          </div>
        </div>
        <div className="text-right">
          {trade.status === "open" ? (
            <span
              className="rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent)]"
            >
              Open
            </span>
          ) : (
            <>
              <div className="font-bebas text-2xl leading-none" style={{ color: outcomeColor }}>
                {(trade.pnl ?? 0) >= 0 ? "+" : ""}
                {formatPrice(trade.pnl ?? 0)}
              </div>
              <div className="font-mono text-[11px]" style={{ color: outcomeColor }}>
                {(trade.pnlPct ?? 0) >= 0 ? "+" : ""}
                {(trade.pnlPct ?? 0).toFixed(2)}%
                {trade.rMultiple !== undefined && (
                  <span className="ml-2">{trade.rMultiple.toFixed(2)}R</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-[color:var(--muted)]">
        {trade.thesis}
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[color:var(--border)]/60 pt-3 font-mono text-[11px] xs:grid-cols-4">
        <Metric label="Size" value={`${trade.size} sh`} />
        <Metric label="Entry" value={formatPrice(trade.entryPrice)} />
        {trade.status === "closed" ? (
          <Metric label="Exit" value={formatPrice(trade.exitPrice!)} />
        ) : (
          <Metric label="Exit" value="—" />
        )}
        <Metric
          label="Stop"
          value={trade.stop ? formatPrice(trade.stop) : "—"}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[color:var(--muted)]">{label}: </span>
      <span className="text-[color:var(--text)]">{value}</span>
    </div>
  );
}
