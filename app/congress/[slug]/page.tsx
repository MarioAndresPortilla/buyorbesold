import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getMemberProfile } from "@/lib/congress-queries";
import type {
  CongressMemberStats,
  CongressStatPeriod,
  CongressTrade,
} from "@/lib/congress-types";

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getMemberProfile(slug).catch(() => null);
  if (!profile) return { title: "Congress Member" };
  return {
    title: `${profile.member.displayName} — Congress Trades`,
    description: `STOCK Act disclosures, timing alpha, and trade history for ${profile.member.displayName}. Not financial advice.`,
  };
}

const PERIODS: { value: CongressStatPeriod; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

function partyLabel(p: string): string {
  if (p === "D") return "Democrat";
  if (p === "R") return "Republican";
  if (p === "I") return "Independent";
  return "Unknown party";
}

function partyColor(p: string): string {
  if (p === "D") return "text-blue-400";
  if (p === "R") return "text-red-400";
  if (p === "I") return "text-purple-400";
  return "text-[color:var(--muted)]";
}

function fmtAlpha(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtDollarRange(t: CongressTrade): string {
  if (t.amountLow != null && t.amountHigh != null) {
    return `${fmtUsd(t.amountLow)} – ${fmtUsd(t.amountHigh)}`;
  }
  if (t.amountMid != null) return `~${fmtUsd(t.amountMid)}`;
  return "undisclosed";
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "up" | "down" | "neutral";
}) {
  const color =
    accent === "up"
      ? "text-emerald-400"
      : accent === "down"
        ? "text-rose-400"
        : "text-[color:var(--text)]";
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--panel)] p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
      <div className={`mt-1 font-bebas text-xl tracking-wide ${color}`}>
        {value}
      </div>
    </div>
  );
}

function StatsBlock({ stats }: { stats: CongressMemberStats | null }) {
  if (!stats || stats.totalTrades === 0) {
    return (
      <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--panel)] p-4 font-mono text-xs text-[color:var(--muted)]">
        No trades disclosed in this period.
      </div>
    );
  }
  const a30 = stats.timingAlpha30dPct;
  const a90 = stats.timingAlpha90dPct;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard
        label="α vs SPY (30D)"
        value={fmtAlpha(a30)}
        accent={a30 == null ? "neutral" : a30 >= 0 ? "up" : "down"}
      />
      <StatCard
        label="α vs SPY (90D)"
        value={fmtAlpha(a90)}
        accent={a90 == null ? "neutral" : a90 >= 0 ? "up" : "down"}
      />
      <StatCard
        label="Win rate 30D"
        value={stats.winRate30d != null ? `${stats.winRate30d.toFixed(0)}%` : "—"}
      />
      <StatCard label="Trades" value={String(stats.totalTrades)} />
      <StatCard label="Buys" value={String(stats.buyCount)} />
      <StatCard label="Sells" value={String(stats.sellCount)} />
      <StatCard label="Unique symbols" value={String(stats.uniqueSymbols)} />
      <StatCard label="Est. volume" value={fmtUsd(stats.estVolumeUsd)} />
    </div>
  );
}

export default async function CongressMemberPage({ params }: Props) {
  const { slug } = await params;
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!safe) notFound();

  const profile = await getMemberProfile(safe);
  if (!profile) notFound();

  const { member, stats, recentTrades, topSymbols } = profile;
  const allStats = stats.all;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-3 py-6 xs:px-4">
        <nav className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
          <Link href="/congress" className="hover:text-[color:var(--accent)]">
            ← Congress Monitor
          </Link>
        </nav>

        {/* Hero */}
        <header className="mb-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-bebas text-3xl tracking-wider">
              {member.displayName}
            </h1>
            <span className={`font-mono text-xs ${partyColor(member.party)}`}>
              {partyLabel(member.party)}
              {member.state ? ` · ${member.state}` : ""}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
              {member.chamber === "unknown" ? "Congress" : member.chamber}
            </span>
          </div>
          <p className="mt-2 font-mono text-[10px] text-[color:var(--muted)]">
            {member.totalTrades} disclosed trades
            {member.lastTradedAt
              ? ` · last trade ${member.lastTradedAt.slice(0, 10)}`
              : ""}
          </p>
        </header>

        {/* All-time stats */}
        <section className="mb-8">
          <h2 className="mb-3 font-bebas text-lg tracking-wider">All-Time Summary</h2>
          <StatsBlock stats={allStats} />
        </section>

        {/* Period breakdowns */}
        <section className="mb-8">
          <h2 className="mb-3 font-bebas text-lg tracking-wider">By Period</h2>
          <div className="space-y-4">
            {PERIODS.filter((p) => p.value !== "all").map((p) => (
              <div key={p.value}>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                  {p.label}
                </div>
                <StatsBlock stats={stats[p.value]} />
              </div>
            ))}
          </div>
        </section>

        {/* Top symbols */}
        {topSymbols.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 font-bebas text-lg tracking-wider">Top Symbols Traded</h2>
            <div className="overflow-x-auto rounded-md border border-[color:var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[color:var(--panel)] font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                  <tr>
                    <th className="p-2">Symbol</th>
                    <th className="p-2">Trades</th>
                    <th className="p-2">Buys</th>
                    <th className="p-2">Sells</th>
                    <th className="p-2">Est. Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {topSymbols.map((s) => (
                    <tr
                      key={s.symbol}
                      className="border-t border-[color:var(--border)] hover:bg-[color:var(--panel)]/60"
                    >
                      <td className="p-2 font-mono font-semibold">{s.symbol}</td>
                      <td className="p-2 font-mono text-xs">{s.tradeCount}</td>
                      <td className="p-2 font-mono text-xs text-emerald-400">{s.buyCount}</td>
                      <td className="p-2 font-mono text-xs text-rose-400">{s.sellCount}</td>
                      <td className="p-2 font-mono text-xs">{fmtUsd(s.estVolumeUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Recent trades */}
        <section className="mb-8">
          <h2 className="mb-3 font-bebas text-lg tracking-wider">
            Recent Trades ({recentTrades.length})
          </h2>
          {recentTrades.length === 0 ? (
            <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--panel)] p-4 font-mono text-xs text-[color:var(--muted)]">
              No trades on file.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[color:var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[color:var(--panel)] font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Symbol</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Owner</th>
                    <th className="p-2">Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((t) => (
                    <tr key={t.id} className="border-t border-[color:var(--border)]">
                      <td className="p-2 font-mono text-xs">{t.transactionDate}</td>
                      <td className="p-2 font-mono font-semibold">{t.symbol}</td>
                      <td className="p-2">
                        <span
                          className={`font-mono text-[10px] uppercase tracking-widest ${
                            t.transactionType === "buy"
                              ? "text-emerald-400"
                              : t.transactionType === "sell"
                                ? "text-rose-400"
                                : "text-[color:var(--muted)]"
                          }`}
                        >
                          {t.transactionType}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-xs">{fmtDollarRange(t)}</td>
                      <td className="p-2 font-mono text-xs text-[color:var(--muted)]">
                        {t.ownerType ?? "—"}
                      </td>
                      <td className="p-2 font-mono text-xs text-[color:var(--muted)]">
                        {t.filingDate ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
          Not financial advice. STOCK Act disclosures lag the actual transaction by
          30–45 days. Timing alpha is a statistical observation, not a prediction.
        </p>
      </main>
      <SiteFooter sub="Congress Monitor · Data: Finnhub · Rebuilt nightly" />
    </>
  );
}
