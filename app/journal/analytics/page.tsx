import type { Metadata } from "next";
import Link from "next/link";
import { listTrades } from "@/lib/kv";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { SETUP_TYPE_LABELS, computeStats, computeTradeDerived } from "@/lib/journal";
import { formatPct, formatPrice } from "@/lib/format";
import type { Trade } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Journal Analytics",
  description:
    "Trading journal analytics: win rate, R-multiple, setup breakdown, best and worst trades. Not financial advice.",
  alternates: { canonical: "/journal/analytics" },
};

export default async function AnalyticsPage() {
  const raw = await listTrades(500);
  const trades = raw.map(computeTradeDerived);
  const stats = computeStats(raw);
  const closed = trades.filter((t) => t.status === "closed");

  // Per-setup breakdown
  const bySetup = new Map<string, Trade[]>();
  for (const t of closed) {
    const arr = bySetup.get(t.setupType) ?? [];
    arr.push(t);
    bySetup.set(t.setupType, arr);
  }

  // R-multiple histogram buckets
  const rValues = closed
    .map((t) => t.rMultiple)
    .filter((r): r is number => typeof r === "number");
  const rBuckets = buildRHistogram(rValues);

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[1000px]" links={[{href: "/journal", label: "← Journal"}]} />

      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-10 xs:py-12">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Journal analytics
          </div>
          <h1 className="font-bebas text-[40px] leading-none tracking-wide xs:text-5xl">
            What actually works
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)]">
            Every closed trade, sliced by setup and R-multiple. Small sample
            sizes lie — wait for {"≥"}50 closed trades before weighing these
            numbers heavily.
          </p>
        </div>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-3 xs:grid-cols-3 sm:grid-cols-4">
          <Card label="Closed trades" value={stats.closedTrades} />
          <Card label="Win rate" value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "—"} />
          <Card
            label="Total P&L"
            value={stats.closedTrades > 0 ? formatPrice(stats.totalPnl) : "—"}
            sub={stats.closedTrades > 0 ? formatPct(stats.totalPnlPct) : undefined}
            kind={stats.totalPnl > 0 ? "up" : stats.totalPnl < 0 ? "down" : undefined}
          />
          <Card
            label="Expectancy"
            value={stats.closedTrades > 0 ? formatPrice(stats.expectancy) : "—"}
            sub="per trade"
            kind={stats.expectancy > 0 ? "up" : stats.expectancy < 0 ? "down" : undefined}
          />
          <Card label="Avg win" value={stats.wins > 0 ? formatPrice(stats.avgWin) : "—"} kind="up" />
          <Card label="Avg loss" value={stats.losses > 0 ? formatPrice(stats.avgLoss) : "—"} kind="down" />
          <Card
            label="Avg R"
            value={stats.avgRMultiple !== undefined ? stats.avgRMultiple.toFixed(2) + "R" : "—"}
          />
          <Card
            label="Win:loss ratio"
            value={
              stats.avgLoss !== 0
                ? Math.abs(stats.avgWin / stats.avgLoss).toFixed(2)
                : "—"
            }
          />
        </section>

        {/* Best / Worst */}
        <section className="grid gap-4 lg:grid-cols-2">
          {stats.bestTrade && (
            <BestWorstCard trade={stats.bestTrade} label="Best trade" kind="up" />
          )}
          {stats.worstTrade && (
            <BestWorstCard trade={stats.worstTrade} label="Worst trade" kind="down" />
          )}
        </section>

        {/* Per-setup breakdown */}
        {bySetup.size > 0 && (
          <section>
            <h2 className="mb-3 font-bebas text-2xl tracking-wide xs:text-3xl">
              By setup type
            </h2>
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
                  <div
                    key={setup}
                    className="grid grid-cols-12 gap-2 border-b border-[color:var(--border)]/50 py-2.5 font-mono text-[12px] last:border-0"
                  >
                    <div className="col-span-4 truncate text-[color:var(--text)]">
                      {SETUP_TYPE_LABELS[setup] ?? setup}
                    </div>
                    <div className="col-span-2 text-right text-[color:var(--muted)]">
                      {s.closedTrades}
                    </div>
                    <div className="col-span-2 text-right text-[color:var(--text)]">
                      {s.winRate.toFixed(0)}%
                    </div>
                    <div className="col-span-2 text-right text-[color:var(--text)]">
                      {s.avgRMultiple !== undefined ? s.avgRMultiple.toFixed(2) : "—"}
                    </div>
                    <div
                      className="col-span-2 text-right font-semibold"
                      style={{
                        color:
                          s.totalPnl > 0
                            ? "var(--up)"
                            : s.totalPnl < 0
                              ? "var(--down)"
                              : "var(--text)",
                      }}
                    >
                      {s.totalPnl > 0 ? "+" : ""}
                      {formatPrice(s.totalPnl)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* R-multiple histogram */}
        {rBuckets.total > 0 && (
          <section>
            <h2 className="mb-3 font-bebas text-2xl tracking-wide xs:text-3xl">
              R-multiple distribution
            </h2>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <div className="space-y-1">
                {rBuckets.buckets.map((b) => (
                  <div key={b.label} className="flex items-center gap-3 font-mono text-[10px]">
                    <div className="w-16 text-[color:var(--muted)]">{b.label}</div>
                    <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-[color:var(--border)]/40">
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${(b.count / rBuckets.max) * 100}%`,
                          background: b.kind === "up" ? "var(--up)" : "var(--down)",
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <div className="w-8 text-right text-[color:var(--text)]">{b.count}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-[10px] italic text-[color:var(--muted)]">
                Based on {rBuckets.total} closed trades with stop set.
              </p>
            </div>
          </section>
        )}

        {stats.totalTrades === 0 && (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-10 text-center">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
              No closed trades yet
            </div>
            <div className="mt-2 text-[13px] text-[color:var(--muted)]">
              Analytics fill in as Mario logs and closes trades.
            </div>
          </div>
        )}

        <SiteFooter minimal />
      </main>
    </div>
  );
}

function Card({
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
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 xs:p-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)] xs:text-[10px]">
        {label}
      </div>
      <div className="mt-1 font-bebas text-2xl leading-none xs:text-3xl" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[9px] text-[color:var(--muted)] xs:text-[10px]">
          {sub}
        </div>
      )}
    </div>
  );
}

function BestWorstCard({
  trade,
  label,
  kind,
}: {
  trade: Trade;
  label: string;
  kind: "up" | "down";
}) {
  const color = kind === "up" ? "var(--up)" : "var(--down)";
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-bebas text-3xl leading-none tracking-wide">
          {trade.symbol}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
          {trade.side} · {SETUP_TYPE_LABELS[trade.setupType] ?? trade.setupType}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-4">
        <span className="font-bebas text-4xl leading-none" style={{ color }}>
          {(trade.pnl ?? 0) >= 0 ? "+" : ""}
          {formatPrice(trade.pnl ?? 0)}
        </span>
        <span className="font-mono text-[12px]" style={{ color }}>
          {(trade.pnlPct ?? 0) >= 0 ? "+" : ""}
          {(trade.pnlPct ?? 0).toFixed(2)}%
          {trade.rMultiple !== undefined && (
            <span className="ml-2">{trade.rMultiple.toFixed(2)}R</span>
          )}
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-[12px] leading-relaxed text-[color:var(--muted)]">
        {trade.thesis}
      </p>
    </div>
  );
}

interface RBucket {
  label: string;
  count: number;
  kind: "up" | "down";
}

function buildRHistogram(rValues: number[]): {
  buckets: RBucket[];
  total: number;
  max: number;
} {
  const ranges: Array<[number, number, string, "up" | "down"]> = [
    [-Infinity, -2, "< -2R", "down"],
    [-2, -1, "-2 to -1R", "down"],
    [-1, 0, "-1 to 0R", "down"],
    [0, 1, "0 to 1R", "up"],
    [1, 2, "1 to 2R", "up"],
    [2, 4, "2 to 4R", "up"],
    [4, Infinity, "> 4R", "up"],
  ];
  const buckets: RBucket[] = ranges.map(([min, max, label, kind]) => ({
    label,
    count: rValues.filter((r) => r >= min && r < max).length,
    kind,
  }));
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return { buckets, total: rValues.length, max };
}
