"use client";

import { useEffect, useState } from "react";
import Sparkline from "./Sparkline";

// ─── Types ───

interface TraderData {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verification: string;
  broker_source: string | null;
  follower_count: number;
  following_count: number;
  created_at: string;
}

interface StatsData {
  closed_trades: number;
  open_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  win_rate_wilson: number;
  total_pnl_pct: number;
  profit_factor: number | null;
  expectancy: number;
  avg_r_multiple: number | null;
  sharpe: number | null;
  sortino: number | null;
  max_drawdown_pct: number;
  max_losing_streak: number;
  avg_hold_duration_label: string;
  best_trade_pnl_pct: number;
  worst_trade_pnl_pct: number;
  equity_curve: { date: string; cumulativePnlPct: number; tradeCount: number }[];
}

interface TradeRow {
  id: string;
  symbol: string;
  asset_class: string;
  side: string;
  strategy: string;
  entry_price: number;
  entry_date: string;
  exit_price: number | null;
  exit_date: string | null;
  pnl_pct: number | null;
  hold_duration_s: number | null;
  comment_count: number;
  reaction_count: number;
  status: string;
}

// ─── Helpers ───

function StatCard({ label, value, suffix = "", color, sub }: {
  label: string;
  value: number | string | null | undefined;
  suffix?: string;
  color?: boolean;
  sub?: string;
}) {
  const num = typeof value === "number" ? value : null;
  const display = num != null && Number.isFinite(num)
    ? num.toFixed(typeof value === "number" && Math.abs(num) < 10 ? 2 : 1) + suffix
    : typeof value === "string" ? value : "—";
  const colorClass = color && num != null
    ? num > 0 ? "text-[color:var(--up)]" : num < 0 ? "text-[color:var(--down)]" : ""
    : "";

  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--muted)] mb-1">
        {label}
      </div>
      <div className={`font-mono text-lg font-bold tabular-nums ${colorClass}`}>
        {display}
      </div>
      {sub && (
        <div className="font-mono text-[10px] text-[color:var(--muted)] mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function VerifBadge({ level, source }: { level: string; source?: string | null }) {
  const labels: Record<string, string> = {
    "self-reported": "Self-reported",
    "screenshot": "Screenshot verified",
    "broker-linked": `Broker: ${source ?? "linked"}`,
    "exchange-api": `Exchange: ${source ?? "linked"}`,
  };
  const colors: Record<string, string> = {
    "self-reported": "text-[color:var(--muted)] border-[color:var(--border)]",
    "screenshot": "text-[color:var(--accent)] border-[color:var(--accent)]/30",
    "broker-linked": "text-[color:var(--up)] border-[color:var(--up)]/30",
    "exchange-api": "text-[color:var(--up)] border-[color:var(--up)]/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] ${colors[level] ?? ""}`}>
      {level !== "self-reported" && <span>&#10003;</span>}
      {labels[level] ?? level}
    </span>
  );
}

// ─── Main Component ───

export default function TraderProfile({ username }: { username: string }) {
  const [trader, setTrader] = useState<TraderData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeRow[]>([]);
  const [openPositions, setOpenPositions] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/social/traders?username=${encodeURIComponent(username)}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Trader not found" : "Failed to load profile");
          return;
        }
        const data = await res.json();
        setTrader(data.trader);
        setStats(data.stats);
        setRecentTrades(data.recentTrades ?? []);
        setOpenPositions(data.openPositions ?? []);
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username]);

  if (loading) {
    return (
      <div className="w-full space-y-4">
        <div className="h-24 rounded-lg bg-[color:var(--surface)] animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-[color:var(--surface)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !trader) {
    return (
      <div className="py-16 text-center text-[color:var(--muted)]">
        {error ?? "Trader not found"}
      </div>
    );
  }

  const curveData = stats?.equity_curve?.map((p) => p.cumulativePnlPct) ?? [];
  const curveUp = curveData.length > 1 ? curveData[curveData.length - 1] > curveData[0] : true;

  return (
    <div className="w-full space-y-6">
      {/* ── Hero Card ── */}
      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[color:var(--bg)] border-2 border-[color:var(--border)] flex items-center justify-center text-xl font-bold uppercase overflow-hidden shrink-0">
              {trader.avatar_url ? (
                <img src={trader.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                trader.username.slice(0, 2)
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold">{trader.display_name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[13px] text-[color:var(--muted)]">
                  @{trader.username}
                </span>
                <VerifBadge level={trader.verification} source={trader.broker_source} />
              </div>
            </div>
          </div>

          {/* Follow button + social counts */}
          <div className="sm:ml-auto flex items-center gap-4">
            <div className="text-center">
              <div className="font-mono text-sm font-bold">{trader.follower_count}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--muted)]">Followers</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-sm font-bold">{trader.following_count}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--muted)]">Following</div>
            </div>
            <button className="rounded border border-[color:var(--accent)] px-4 py-1.5 font-mono text-[11px] font-bold text-[color:var(--accent)] hover:bg-[color:var(--accent)]/10 transition-colors">
              + Follow
            </button>
          </div>
        </div>

        {trader.bio && (
          <p className="mt-3 text-[13px] text-[color:var(--muted)]">{trader.bio}</p>
        )}

        {/* Equity curve (hero) */}
        {curveData.length > 2 && (
          <div className="mt-4 -mx-2">
            <Sparkline data={curveData} up={curveUp} height={80} className="w-full" />
          </div>
        )}
      </div>

      {/* ── Stats Grid ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          <StatCard
            label="Total Return"
            value={stats.total_pnl_pct}
            suffix="%"
            color
          />
          <StatCard
            label="Win Rate"
            value={stats.win_rate}
            suffix="%"
            sub={`Wilson: ${stats.win_rate_wilson.toFixed(1)}% (${stats.closed_trades} trades)`}
          />
          <StatCard
            label="Profit Factor"
            value={stats.profit_factor}
          />
          <StatCard
            label="Sharpe"
            value={stats.sharpe}
          />
          <StatCard
            label="Max Drawdown"
            value={stats.max_drawdown_pct}
            suffix="%"
            color
          />
          <StatCard
            label="Expectancy"
            value={stats.expectancy}
            suffix="%"
            color
          />
          <StatCard
            label="Avg R-Multiple"
            value={stats.avg_r_multiple}
          />
          <StatCard
            label="Sortino"
            value={stats.sortino}
          />
          <StatCard
            label="Avg Hold"
            value={stats.avg_hold_duration_label}
          />
          <StatCard
            label="Losing Streak"
            value={stats.max_losing_streak}
            sub={`Best: ${stats.best_trade_pnl_pct > 0 ? "+" : ""}${stats.best_trade_pnl_pct.toFixed(1)}% / Worst: ${stats.worst_trade_pnl_pct.toFixed(1)}%`}
          />
        </div>
      )}

      {/* ── Open Positions ── */}
      {openPositions.length > 0 && (
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-[color:var(--muted)] mb-2">
            Open Positions ({openPositions.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[12px]">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                  <th className="py-2 pr-3">Ticker</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Strategy</th>
                  <th className="py-2 pr-3 text-right">Entry</th>
                  <th className="py-2 pr-3 text-right">Stop</th>
                  <th className="py-2 text-right">Target</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((t) => (
                  <tr key={t.id} className="border-b border-[color:var(--border)]/30">
                    <td className="py-2 pr-3 font-semibold">{t.symbol}</td>
                    <td className={`py-2 pr-3 text-[10px] font-bold uppercase ${
                      t.side === "long" ? "text-[color:var(--up)]" : "text-[color:var(--down)]"
                    }`}>{t.side}</td>
                    <td className="py-2 pr-3 text-[color:var(--muted)]">{t.strategy}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">${t.entry_price.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--down)]">
                      {t.stop_price != null ? `$${t.stop_price.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[color:var(--up)]">
                      {t.target_price != null ? `$${t.target_price.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recent Trades ── */}
      <div>
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-[color:var(--muted)] mb-2">
          Recent Trades ({recentTrades.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[12px]">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                <th className="py-2 pr-3">Ticker</th>
                <th className="py-2 pr-3">Side</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Strategy</th>
                <th className="py-2 pr-3 text-right">Entry</th>
                <th className="py-2 pr-3 text-right">Exit</th>
                <th className="py-2 pr-3 text-right">P&amp;L</th>
                <th className="py-2 text-right hidden md:table-cell">Hold</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[color:var(--muted)]">
                    No closed trades yet.
                  </td>
                </tr>
              ) : (
                recentTrades.map((t) => {
                  const isWin = t.pnl_pct != null && t.pnl_pct > 0;
                  const isLoss = t.pnl_pct != null && t.pnl_pct < 0;
                  return (
                    <tr key={t.id} className="border-b border-[color:var(--border)]/30 hover:bg-[color:var(--surface)]/50 transition-colors">
                      <td className="py-2 pr-3 font-semibold">{t.symbol}</td>
                      <td className={`py-2 pr-3 text-[10px] font-bold uppercase ${
                        t.side === "long" ? "text-[color:var(--up)]" : "text-[color:var(--down)]"
                      }`}>{t.side}</td>
                      <td className="py-2 pr-3 text-[color:var(--muted)] hidden sm:table-cell">{t.strategy}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">${t.entry_price.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {t.exit_price != null ? `$${t.exit_price.toFixed(2)}` : "—"}
                      </td>
                      <td className={`py-2 pr-3 text-right font-bold tabular-nums ${
                        isWin ? "text-[color:var(--up)]" : isLoss ? "text-[color:var(--down)]" : ""
                      }`}>
                        {t.pnl_pct != null
                          ? `${t.pnl_pct > 0 ? "+" : ""}${t.pnl_pct.toFixed(2)}%`
                          : "—"
                        }
                      </td>
                      <td className="py-2 text-right text-[color:var(--muted)] hidden md:table-cell">
                        {t.hold_duration_s != null
                          ? formatHold(t.hold_duration_s)
                          : "—"
                        }
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="font-mono text-[9px] text-[color:var(--muted)] text-center">
        Past performance is not indicative of future results. Not financial advice.
      </p>
    </div>
  );
}

function formatHold(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function stop_price(t: TradeRow): string {
  return t.stop_price != null ? `$${t.stop_price.toFixed(2)}` : "—";
}
