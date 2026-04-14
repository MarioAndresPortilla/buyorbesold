"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  CongressLeaderEntry,
  CongressStatPeriod,
} from "@/lib/congress-types";
import type { CongressRankMetric } from "@/lib/congress-queries";

const PERIODS: { value: CongressStatPeriod; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const METRICS: { value: CongressRankMetric; label: string; short: string }[] = [
  { value: "timing_alpha_30d", label: "30-Day Alpha vs SPY", short: "α 30D" },
  { value: "timing_alpha_90d", label: "90-Day Alpha vs SPY", short: "α 90D" },
  { value: "win_rate_30d", label: "30-Day Win Rate", short: "Win %" },
  { value: "total_trades", label: "Total Trades", short: "Trades" },
  { value: "est_volume_usd", label: "Estimated $ Volume", short: "Volume" },
];

function formatAlpha(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function formatUsdCompact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function partyColor(p: string): string {
  if (p === "D") return "text-blue-400";
  if (p === "R") return "text-red-400";
  if (p === "I") return "text-purple-400";
  return "text-[color:var(--muted)]";
}

function HeroCard({ entry, metric }: { entry: CongressLeaderEntry; metric: CongressRankMetric }) {
  const value = primaryMetric(entry, metric);
  const isAlpha = metric === "timing_alpha_30d" || metric === "timing_alpha_90d";
  const positive = typeof value.raw === "number" && value.raw >= 0;

  return (
    <Link
      href={`/congress/${entry.member.id}`}
      className="group flex flex-col justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--panel)] p-4 transition-colors hover:border-[color:var(--accent)]/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
            Rank #{entry.rank}
          </div>
          <div className="mt-1 truncate font-bebas text-xl tracking-wider">
            {entry.member.displayName}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[color:var(--muted)]">
            <span className={partyColor(entry.member.party)}>{entry.member.party}</span>
            {entry.member.state ? ` · ${entry.member.state}` : ""}
            {` · ${entry.member.chamber === "unknown" ? "Congress" : entry.member.chamber}`}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
          {METRICS.find((m) => m.value === metric)?.label ?? metric}
        </div>
        <div
          className={`mt-1 font-bebas text-3xl tracking-wide ${
            isAlpha ? (positive ? "text-emerald-400" : "text-rose-400") : "text-[color:var(--text)]"
          }`}
        >
          {value.display}
        </div>
        <div className="mt-2 font-mono text-[10px] text-[color:var(--muted)]">
          {entry.stats.totalTrades} trades · {entry.stats.uniqueSymbols} symbols
          {entry.stats.topSymbol ? ` · top: ${entry.stats.topSymbol}` : ""}
        </div>
      </div>
    </Link>
  );
}

function primaryMetric(entry: CongressLeaderEntry, metric: CongressRankMetric): {
  display: string;
  raw: number | null;
} {
  switch (metric) {
    case "timing_alpha_30d":
      return { display: formatAlpha(entry.stats.timingAlpha30dPct), raw: entry.stats.timingAlpha30dPct };
    case "timing_alpha_90d":
      return { display: formatAlpha(entry.stats.timingAlpha90dPct), raw: entry.stats.timingAlpha90dPct };
    case "win_rate_30d":
      return { display: formatPct(entry.stats.winRate30d), raw: entry.stats.winRate30d };
    case "total_trades":
      return { display: String(entry.stats.totalTrades), raw: entry.stats.totalTrades };
    case "est_volume_usd":
      return { display: formatUsdCompact(entry.stats.estVolumeUsd), raw: entry.stats.estVolumeUsd };
  }
}

export default function CongressLeaderboard() {
  const [period, setPeriod] = useState<CongressStatPeriod>("1y");
  const [metric, setMetric] = useState<CongressRankMetric>("timing_alpha_30d");
  const [entries, setEntries] = useState<CongressLeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/congress/leaderboard?period=${period}&metric=${metric}&limit=20`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { entries: CongressLeaderEntry[] };
      setEntries(json.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [period, metric]);

  useEffect(() => {
    load();
  }, [load]);

  const top5 = entries.slice(0, 5);
  const rest = entries.slice(5);

  return (
    <div>
      {/* Filter controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--panel)] p-0.5 font-mono text-[10px] uppercase tracking-widest">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded px-2.5 py-1 transition-colors ${
                period === p.value
                  ? "bg-[color:var(--accent)] text-black"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--panel)] p-0.5 font-mono text-[10px] uppercase tracking-widest">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`rounded px-2.5 py-1 transition-colors ${
                metric === m.value
                  ? "bg-[color:var(--accent)] text-black"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
              title={m.label}
            >
              {m.short}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / empty / error states */}
      {loading && (
        <div className="py-10 text-center font-mono text-[11px] uppercase tracking-widest text-[color:var(--muted)]">
          Loading rankings…
        </div>
      )}
      {error && !loading && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 font-mono text-xs text-rose-300">
          {error}
        </div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--panel)] p-6 text-center font-mono text-xs text-[color:var(--muted)]">
          No qualifying members yet for this period. The nightly sync needs a
          few runs to accumulate data.
        </div>
      )}

      {/* Top 5 hero grid */}
      {!loading && top5.length > 0 && (
        <>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
            Top 5
          </div>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {top5.map((e) => (
              <HeroCard key={e.member.id} entry={e} metric={metric} />
            ))}
          </div>
        </>
      )}

      {/* Rows 6-20 table */}
      {!loading && rest.length > 0 && (
        <>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
            Top 6–{5 + rest.length}
          </div>
          <div className="overflow-x-auto rounded-md border border-[color:var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[color:var(--panel)] font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Member</th>
                  <th className="p-2">α 30D</th>
                  <th className="p-2">α 90D</th>
                  <th className="p-2">Win 30D</th>
                  <th className="p-2">Trades</th>
                  <th className="p-2">Volume</th>
                  <th className="p-2">Top</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((e) => (
                  <tr
                    key={e.member.id}
                    className="border-t border-[color:var(--border)] hover:bg-[color:var(--panel)]/60"
                  >
                    <td className="p-2 font-mono text-xs text-[color:var(--muted)]">
                      {e.rank}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/congress/${e.member.id}`}
                        className="hover:text-[color:var(--accent)]"
                      >
                        <span className="font-medium">{e.member.displayName}</span>
                        <span className={`ml-2 font-mono text-[10px] ${partyColor(e.member.party)}`}>
                          {e.member.party}
                          {e.member.state ? `-${e.member.state}` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className={`p-2 font-mono text-xs ${alphaClass(e.stats.timingAlpha30dPct)}`}>
                      {formatAlpha(e.stats.timingAlpha30dPct)}
                    </td>
                    <td className={`p-2 font-mono text-xs ${alphaClass(e.stats.timingAlpha90dPct)}`}>
                      {formatAlpha(e.stats.timingAlpha90dPct)}
                    </td>
                    <td className="p-2 font-mono text-xs">{formatPct(e.stats.winRate30d)}</td>
                    <td className="p-2 font-mono text-xs">{e.stats.totalTrades}</td>
                    <td className="p-2 font-mono text-xs">{formatUsdCompact(e.stats.estVolumeUsd)}</td>
                    <td className="p-2 font-mono text-xs text-[color:var(--muted)]">
                      {e.stats.topSymbol ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function alphaClass(v: number | null): string {
  if (v == null) return "text-[color:var(--muted)]";
  return v >= 0 ? "text-emerald-400" : "text-rose-400";
}
