import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isKvAvailable, listUserTrades } from "@/lib/kv";
import { SETUP_TYPE_LABELS, computeStats, computeTradeDerived, getDailyTopMovers } from "@/lib/journal";
import { arrow, formatPct, formatPrice } from "@/lib/format";
import type { Trade } from "@/lib/types";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Journal",
  description: "Your private trading journal on BuyOrBeSold.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ welcome?: string }>;
}

export default async function MyJournalPage({ searchParams }: PageProps) {
  const email = await getUser();
  if (!email) redirect("/login");

  const [rawTrades, sp] = await Promise.all([listUserTrades(email, 200), searchParams]);
  const trades = rawTrades.map(computeTradeDerived);
  const stats = computeStats(rawTrades);
  const kvOn = isKvAvailable();
  const welcome = sp.welcome === "1";

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav
        maxWidth="max-w-[1100px]"
        links={[
          { href: "/scanner", label: "Scanner" },
          { href: "/journal", label: "Mario's Log", short: "Log" },
          { href: "/my-journal/analytics", label: "My Stats", hideBelow: "xs" },
        ]}
        trailing={<LogoutButton />}
      />

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 xs:py-10">
        {welcome && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-[11px] text-emerald-400">
            ✓ Welcome! This is your private trading journal. Only you can see it.
          </div>
        )}

        {!kvOn && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 font-mono text-[12px] text-amber-400">
            Journal storage is temporarily unavailable. Try again later.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
              🔒 Private · {email}
            </div>
            <h1 className="font-bebas text-[44px] leading-none tracking-wide xs:text-5xl sm:text-6xl">
              My journal
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)] xs:text-[14px]">
              Your trades, your stats, your edge. Only you can see this page.
            </p>
          </div>
          <Link
            href="/my-journal/new"
            className="inline-flex items-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90"
          >
            + Log trade
          </Link>
        </div>

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
            kind={stats.totalPnl > 0 ? "up" : stats.totalPnl < 0 ? "down" : undefined}
          />
          <StatCard
            label="Avg R"
            value={stats.avgRMultiple !== undefined ? stats.avgRMultiple.toFixed(2) + "R" : "—"}
          />
        </section>

        {/* Trades */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-bebas text-2xl tracking-wide xs:text-3xl">Recent trades</h2>
            <Link
              href="/my-journal/analytics"
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--accent)] hover:underline"
            >
              Full analytics →
            </Link>
          </div>
          {trades.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-10 text-center">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                No trades yet
              </div>
              <p className="mt-2 text-[13px] text-[color:var(--muted)]">
                Hit the button above to log your first trade. Every entry builds your edge.
              </p>
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
  const color = kind === "up" ? "var(--up)" : kind === "down" ? "var(--down)" : "var(--text)";
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</div>
      <div className="mt-1 font-bebas text-3xl leading-none" style={{ color }}>{value}</div>
      {sub && <div className="mt-1 font-mono text-[10px] text-[color:var(--muted)]">{sub}</div>}
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const sideColor = trade.side === "long" ? "var(--up)" : "var(--down)";
  const outcomeColor = trade.outcome === "win" ? "var(--up)" : trade.outcome === "loss" ? "var(--down)" : "var(--muted)";
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: sideColor }} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bebas text-2xl leading-none tracking-wide text-[color:var(--text)]">{trade.symbol}</span>
            <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: sideColor, background: `color-mix(in oklab, ${sideColor} 14%, transparent)` }}>{trade.side}</span>
            <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[color:var(--muted)]">{SETUP_TYPE_LABELS[trade.setupType] ?? trade.setupType}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
            Entered {new Date(trade.entryDate).toLocaleDateString("en-US")}
            {trade.exitDate && ` · Exited ${new Date(trade.exitDate).toLocaleDateString("en-US")}`}
          </div>
        </div>
        <div className="text-right">
          {trade.status === "open" ? (
            <span className="rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent)]">Open</span>
          ) : (
            <>
              <div className="font-bebas text-2xl leading-none" style={{ color: outcomeColor }}>
                {(trade.pnl ?? 0) >= 0 ? "+" : ""}{formatPrice(trade.pnl ?? 0)}
              </div>
              <div className="font-mono text-[11px]" style={{ color: outcomeColor }}>
                {formatPct(trade.pnlPct ?? 0)}
                {trade.rMultiple !== undefined && <span className="ml-2">{trade.rMultiple.toFixed(2)}R</span>}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-[color:var(--muted)]">{trade.thesis}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[color:var(--border)]/60 pt-3 font-mono text-[11px] xs:grid-cols-4">
        <span><span className="text-[color:var(--muted)]">Size: </span>{trade.size} sh</span>
        <span><span className="text-[color:var(--muted)]">Entry: </span>{formatPrice(trade.entryPrice)}</span>
        <span><span className="text-[color:var(--muted)]">Exit: </span>{trade.exitPrice ? formatPrice(trade.exitPrice) : "—"}</span>
        <span><span className="text-[color:var(--muted)]">Stop: </span>{trade.stop ? formatPrice(trade.stop) : "—"}</span>
      </div>
    </div>
  );
}
