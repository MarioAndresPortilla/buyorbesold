"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Sparkline from "./Sparkline";
import KeyboardNav from "./KeyboardNav";

// ─── Types (mirror API response shape) ───

interface RankEntry {
  rank: number;
  trader_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verification: string;
  closed_trades: number;
  win_rate: number;
  win_rate_wilson: number;
  total_pnl_pct: number;
  profit_factor: number | null;
  sharpe: number | null;
  max_drawdown_pct: number;
  avg_r_multiple: number | null;
  equity_curve: { date: string; cumulativePnlPct: number; tradeCount: number }[];
  avg_hold_duration_label: string;
  best_trade_pnl_pct: number;
  worst_trade_pnl_pct: number;
}

// ─── Filter Options ───

type Period = "1d" | "1w" | "1m" | "3m" | "ytd" | "1y" | "all";
type AssetFilter = "all" | "stocks" | "options" | "crypto" | "forex";
type SideFilter = "both" | "long" | "short";
type SortKey = "sharpe" | "profit_factor" | "total_pnl_pct" | "win_rate" | "expectancy" | "avg_r_multiple";

const PERIODS: { value: Period; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const ASSETS: { value: AssetFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "stocks", label: "Stocks" },
  { value: "options", label: "Options" },
  { value: "crypto", label: "Crypto" },
  { value: "forex", label: "Forex" },
];

const SIDES: { value: SideFilter; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "long", label: "Longs" },
  { value: "short", label: "Shorts" },
];

const SORT_OPTIONS: { value: SortKey; label: string; short: string }[] = [
  { value: "sharpe", label: "Sharpe Ratio", short: "Sharpe" },
  { value: "profit_factor", label: "Profit Factor", short: "PF" },
  { value: "total_pnl_pct", label: "Total Return", short: "Return" },
  { value: "win_rate", label: "Win Rate (Wilson)", short: "Win%" },
  { value: "expectancy", label: "Expectancy", short: "E[R]" },
  { value: "avg_r_multiple", label: "Avg R-Multiple", short: "Avg R" },
];

const MIN_TRADES: Record<Period, number> = {
  "1d": 1, "1w": 3, "1m": 10, "3m": 25, ytd: 50, "1y": 50, all: 100,
};

// ─── Verification badge ───

function VerifBadge({ level }: { level: string }) {
  if (level === "self-reported") return null;
  const color =
    level === "broker-linked" || level === "exchange-api"
      ? "text-[color:var(--up)]"
      : "text-[color:var(--accent)]";
  const title =
    level === "broker-linked"
      ? "Broker-linked"
      : level === "exchange-api"
        ? "Exchange-verified"
        : "Screenshot";
  return (
    <span className={`ml-1 ${color}`} title={title}>
      &#10003;
    </span>
  );
}

// ─── Stat cell helper ───

function Stat({ value, suffix = "", precision = 1, color }: {
  value: number | null | undefined;
  suffix?: string;
  precision?: number;
  color?: boolean;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-[color:var(--muted)]">—</span>;
  }
  const formatted = value.toFixed(precision) + suffix;
  const colorClass = color
    ? value > 0
      ? "text-[color:var(--up)]"
      : value < 0
        ? "text-[color:var(--down)]"
        : ""
    : "";
  return <span className={colorClass}>{formatted}</span>;
}

// ─── Main Component ───

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>("1m");
  const [asset, setAsset] = useState<AssetFilter>("all");
  const [side, setSide] = useState<SideFilter>("both");
  const [sortBy, setSortBy] = useState<SortKey>("sharpe");
  const [verified, setVerified] = useState(true);
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        asset_class: asset,
        side,
        sort_by: sortBy,
        verified: String(verified),
        limit: "50",
      });
      const res = await fetch(`/api/social/rankings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRankings(data.rankings ?? []);
      }
    } catch {
      // Silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [period, asset, side, sortBy, verified]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return (
    <KeyboardNav
      rowCount={rankings.length}
      onEnter={(i) => `/trader/${rankings[i]?.username}`}
    >
    <div className="w-full">
      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] pb-3 mb-4">
        {/* Period pills */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] tracking-wider transition-colors ${
                period === p.value
                  ? "bg-[color:var(--accent)]/20 text-[color:var(--accent)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <span className="hidden sm:inline text-[color:var(--border)]">|</span>

        {/* Asset class pills */}
        <div className="flex gap-1">
          {ASSETS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAsset(a.value)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] tracking-wider transition-colors ${
                asset === a.value
                  ? "bg-[color:var(--accent)]/20 text-[color:var(--accent)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <span className="hidden sm:inline text-[color:var(--border)]">|</span>

        {/* Side pills */}
        <div className="flex gap-1">
          {SIDES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSide(s.value)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] tracking-wider transition-colors ${
                side === s.value
                  ? "bg-[color:var(--accent)]/20 text-[color:var(--accent)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Verified toggle */}
        <button
          onClick={() => setVerified(!verified)}
          className={`ml-auto rounded px-2.5 py-1 font-mono text-[11px] tracking-wider transition-colors ${
            verified
              ? "bg-[color:var(--up)]/15 text-[color:var(--up)]"
              : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
          }`}
          title={verified ? "Showing verified traders only" : "Showing all traders"}
        >
          {verified ? "Verified" : "All traders"}
        </button>
      </div>

      {/* ── Sort selector ── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
          Rank by
        </span>
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`rounded px-2 py-0.5 font-mono text-[10px] tracking-wider transition-colors ${
                sortBy === opt.value
                  ? "bg-[color:var(--surface)] text-[color:var(--text)] border border-[color:var(--border)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
              title={opt.label}
            >
              {opt.short}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] text-[color:var(--muted)]">
          Min {MIN_TRADES[period]} trades
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-[12px]">
          <thead>
            <tr className="border-b border-[color:var(--border)] text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
              <th className="py-2 pr-2 w-8">#</th>
              <th className="py-2 pr-3">Trader</th>
              <th className="py-2 pr-3 w-[100px] hidden sm:table-cell">Equity</th>
              <th className="py-2 pr-3 text-right">P&amp;L%</th>
              <th className="py-2 pr-3 text-right hidden md:table-cell">PF</th>
              <th className="py-2 pr-3 text-right">Win%<span className="hidden lg:inline"> (n)</span></th>
              <th className="py-2 pr-3 text-right hidden md:table-cell">Max DD</th>
              <th className="py-2 pr-3 text-right hidden lg:table-cell">Sharpe</th>
              <th className="py-2 pr-3 text-right hidden lg:table-cell">Avg R</th>
              <th className="py-2 text-right">Trades</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton rows
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-[color:var(--border)]/50">
                  <td colSpan={10} className="py-3">
                    <div className="h-4 w-full rounded bg-[color:var(--surface)] animate-pulse" />
                  </td>
                </tr>
              ))
            ) : rankings.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-[color:var(--muted)]">
                  No traders meet the minimum {MIN_TRADES[period]} trades for this period.
                </td>
              </tr>
            ) : (
              rankings.map((r) => {
                const curveData = r.equity_curve?.map((p) => p.cumulativePnlPct) ?? [];
                const curveUp = curveData.length > 1
                  ? curveData[curveData.length - 1] > curveData[0]
                  : true;

                return (
                  <tr
                    key={r.trader_id}
                    className="border-b border-[color:var(--border)]/30 hover:bg-[color:var(--surface)]/50 transition-colors group"
                  >
                    {/* Rank */}
                    <td className="py-2.5 pr-2 text-[color:var(--muted)]">
                      {r.rank}
                    </td>

                    {/* Trader */}
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/trader/${r.username}`}
                        className="flex items-center gap-2 group-hover:text-[color:var(--accent)] transition-colors"
                      >
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full bg-[color:var(--surface)] border border-[color:var(--border)] flex items-center justify-center text-[10px] font-bold uppercase overflow-hidden shrink-0">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            r.username.slice(0, 2)
                          )}
                        </div>
                        <span className="truncate max-w-[120px]">
                          @{r.username}
                        </span>
                        <VerifBadge level={r.verification} />
                      </Link>
                    </td>

                    {/* Equity curve sparkline */}
                    <td className="py-2.5 pr-3 hidden sm:table-cell">
                      {curveData.length > 2 ? (
                        <Sparkline
                          data={curveData}
                          up={curveUp}
                          height={28}
                          className="w-[90px]"
                        />
                      ) : (
                        <span className="text-[color:var(--muted)]">—</span>
                      )}
                    </td>

                    {/* P&L% */}
                    <td className="py-2.5 pr-3 text-right font-semibold">
                      <Stat value={r.total_pnl_pct} suffix="%" color />
                    </td>

                    {/* Profit Factor */}
                    <td className="py-2.5 pr-3 text-right hidden md:table-cell">
                      <Stat value={r.profit_factor} precision={2} />
                    </td>

                    {/* Win Rate (n) */}
                    <td className="py-2.5 pr-3 text-right">
                      <Stat value={r.win_rate} suffix="%" precision={0} />
                      <span className="hidden lg:inline text-[color:var(--muted)] ml-1">
                        ({r.closed_trades})
                      </span>
                    </td>

                    {/* Max Drawdown */}
                    <td className="py-2.5 pr-3 text-right hidden md:table-cell">
                      <Stat value={r.max_drawdown_pct} suffix="%" color />
                    </td>

                    {/* Sharpe */}
                    <td className="py-2.5 pr-3 text-right hidden lg:table-cell">
                      <Stat value={r.sharpe} precision={2} />
                    </td>

                    {/* Avg R */}
                    <td className="py-2.5 pr-3 text-right hidden lg:table-cell">
                      <Stat value={r.avg_r_multiple} precision={2} />
                    </td>

                    {/* Trades count */}
                    <td className="py-2.5 text-right text-[color:var(--muted)]">
                      {r.closed_trades}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Disclaimer ── */}
      <p className="mt-4 font-mono text-[9px] text-[color:var(--muted)] text-center">
        Past performance is not indicative of future results. Not financial advice.
        Rankings use Wilson confidence-adjusted win rates and require minimum trade counts.
      </p>
    </div>
    </KeyboardNav>
  );
}
