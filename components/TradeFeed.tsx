"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import KeyboardNav from "./KeyboardNav";

// ─── Types ───

interface FeedTrade {
  id: string;
  trader_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  trader_verification: string;
  symbol: string;
  instrument_name: string | null;
  asset_class: string;
  side: string;
  strategy: string;
  size: number;
  size_unit: string;
  entry_price: number;
  entry_date: string;
  exit_price: number | null;
  exit_date: string | null;
  stop_price: number | null;
  target_price: number | null;
  thesis: string | null;
  tags: string[];
  verification: string;
  status: string;
  pnl_pct: number | null;
  hold_duration_s: number | null;
  comment_count: number;
  reaction_count: number;
  created_at: string;
}

type ViewMode = "table" | "cards";

// ─── Helpers ───

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function PnlBadge({ pct, status }: { pct: number | null; status: string }) {
  if (status === "open" || pct == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[color:var(--accent)]/15 text-[color:var(--accent)]">
        OPEN
      </span>
    );
  }
  const isWin = pct > 0;
  const color = isWin ? "var(--up)" : pct < 0 ? "var(--down)" : "var(--muted)";
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {isWin ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

function SideBadge({ side }: { side: string }) {
  const isLong = side === "long";
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest ${
      isLong ? "text-[color:var(--up)]" : "text-[color:var(--down)]"
    }`}>
      {side}
    </span>
  );
}

function StrategyBadge({ strategy }: { strategy: string }) {
  return (
    <span className="rounded bg-[color:var(--surface)] border border-[color:var(--border)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
      {strategy}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${
        status === "open" ? "bg-[color:var(--accent)]" : "bg-[color:var(--muted)]/40"
      }`}
      title={status === "open" ? "Position open" : "Closed"}
    />
  );
}

// ─── Main Component ───

export default function TradeFeed() {
  const [trades, setTrades] = useState<FeedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Filters
  const [assetClass, setAssetClass] = useState<string>("");
  const [side, setSide] = useState<string>("");
  const [strategy, setStrategy] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [sort, setSort] = useState<string>("newest");

  const fetchTrades = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: "30", offset: String(offset) });
      if (assetClass) params.set("asset_class", assetClass);
      if (side) params.set("side", side);
      if (strategy) params.set("strategy", strategy);
      if (status) params.set("status", status);

      const res = await fetch(`/api/social/feed?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (offset === 0) {
          setTrades(data.trades ?? []);
        } else {
          setTrades((prev) => [...prev, ...(data.trades ?? [])]);
        }
        setHasMore(data.hasMore ?? false);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [assetClass, side, strategy, status, sort]);

  useEffect(() => {
    fetchTrades(0);
  }, [fetchTrades]);

  const filterPill = (
    label: string,
    value: string,
    setter: (v: string) => void,
    options: { value: string; label: string }[]
  ) => (
    <select
      value={value}
      onChange={(e) => setter(e.target.value)}
      className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded px-2 py-1 font-mono text-[11px] text-[color:var(--text)] appearance-none cursor-pointer"
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );

  return (
    <KeyboardNav
      rowCount={trades.length}
      onEnter={(i) => `/trader/${trades[i]?.username}`}
    >
    <div className="w-full">
      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] pb-3 mb-4">
        {filterPill("Asset Class", assetClass, setAssetClass, [
          { value: "stocks", label: "Stocks" },
          { value: "options", label: "Options" },
          { value: "crypto", label: "Crypto" },
          { value: "forex", label: "Forex" },
        ])}
        {filterPill("Side", side, setSide, [
          { value: "long", label: "Long" },
          { value: "short", label: "Short" },
        ])}
        {filterPill("Strategy", strategy, setStrategy, [
          { value: "daytrade", label: "Daytrade" },
          { value: "swing", label: "Swing" },
          { value: "scalp", label: "Scalp" },
          { value: "position", label: "Position" },
        ])}
        {filterPill("Status", status, setStatus, [
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ])}

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded px-2 py-1 font-mono text-[11px] text-[color:var(--text)] appearance-none cursor-pointer"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="biggest_win">Biggest Win</option>
          <option value="biggest_loss">Biggest Loss</option>
          <option value="most_discussed">Most Discussed</option>
        </select>

        {/* View toggle */}
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setViewMode("table")}
            className={`rounded px-2 py-1 text-[11px] transition-colors ${
              viewMode === "table"
                ? "bg-[color:var(--surface)] text-[color:var(--text)] border border-[color:var(--border)]"
                : "text-[color:var(--muted)]"
            }`}
            title="Table view"
          >
            |||
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={`rounded px-2 py-1 text-[11px] transition-colors ${
              viewMode === "cards"
                ? "bg-[color:var(--surface)] text-[color:var(--text)] border border-[color:var(--border)]"
                : "text-[color:var(--muted)]"
            }`}
            title="Card view"
          >
            &#9638;&#9638;
          </button>
        </div>
      </div>

      {/* ── Table View ── */}
      {viewMode === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[12px]">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                <th className="py-2 pr-2 w-4"></th>
                <th className="py-2 pr-3">Trader</th>
                <th className="py-2 pr-3">Ticker</th>
                <th className="py-2 pr-3">Side</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Strategy</th>
                <th className="py-2 pr-3 text-right">Entry</th>
                <th className="py-2 pr-3 text-right">Exit</th>
                <th className="py-2 pr-3 text-right">P&amp;L</th>
                <th className="py-2 pr-3 text-right hidden md:table-cell">Hold</th>
                <th className="py-2 pr-3 text-right hidden lg:table-cell">Social</th>
                <th className="py-2 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {loading && trades.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[color:var(--border)]/50">
                    <td colSpan={11} className="py-3">
                      <div className="h-4 w-full rounded bg-[color:var(--surface)] animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[color:var(--muted)]">
                    No trades match your filters.
                  </td>
                </tr>
              ) : (
                trades.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[color:var(--border)]/30 hover:bg-[color:var(--surface)]/50 transition-colors"
                  >
                    <td className="py-2 pr-2"><StatusDot status={t.status} /></td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/trader/${t.username}`}
                        className="flex items-center gap-1.5 hover:text-[color:var(--accent)] transition-colors"
                      >
                        <div className="w-5 h-5 rounded-full bg-[color:var(--surface)] border border-[color:var(--border)] flex items-center justify-center text-[8px] font-bold uppercase overflow-hidden shrink-0">
                          {t.avatar_url ? (
                            <img src={t.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            t.username.slice(0, 2)
                          )}
                        </div>
                        <span className="truncate max-w-[80px]">@{t.username}</span>
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-semibold">{t.symbol}</td>
                    <td className="py-2 pr-3"><SideBadge side={t.side} /></td>
                    <td className="py-2 pr-3 hidden sm:table-cell"><StrategyBadge strategy={t.strategy} /></td>
                    <td className="py-2 pr-3 text-right tabular-nums">${t.entry_price.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {t.exit_price != null ? `$${t.exit_price.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <PnlBadge pct={t.pnl_pct} status={t.status} />
                    </td>
                    <td className="py-2 pr-3 text-right text-[color:var(--muted)] hidden md:table-cell">
                      {formatDuration(t.hold_duration_s)}
                    </td>
                    <td className="py-2 pr-3 text-right text-[color:var(--muted)] hidden lg:table-cell">
                      {t.comment_count > 0 && (
                        <span className="mr-2" title="Comments">
                          &#128172;{t.comment_count}
                        </span>
                      )}
                      {t.reaction_count > 0 && (
                        <span title="Reactions">
                          &#128293;{t.reaction_count}
                        </span>
                      )}
                      {t.comment_count === 0 && t.reaction_count === 0 && "—"}
                    </td>
                    <td className="py-2 text-right text-[color:var(--muted)]" title={new Date(t.created_at).toLocaleString()}>
                      {timeAgo(t.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Card View ── */
        <div className="grid gap-2">
          {loading && trades.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-[color:var(--surface)] animate-pulse" />
            ))
          ) : trades.length === 0 ? (
            <p className="py-12 text-center text-[color:var(--muted)]">
              No trades match your filters.
            </p>
          ) : (
            trades.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 hover:border-[color:var(--accent)]/30 transition-colors"
              >
                {/* Avatar */}
                <Link href={`/trader/${t.username}`} className="shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[color:var(--bg)] border border-[color:var(--border)] flex items-center justify-center text-[10px] font-bold uppercase overflow-hidden">
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      t.username.slice(0, 2)
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[12px]">
                    <Link href={`/trader/${t.username}`} className="font-semibold hover:text-[color:var(--accent)] transition-colors">
                      @{t.username}
                    </Link>
                    <span className="font-bold">{t.symbol}</span>
                    <SideBadge side={t.side} />
                    <StrategyBadge strategy={t.strategy} />
                  </div>
                  {t.thesis && (
                    <p className="text-[11px] text-[color:var(--muted)] truncate mt-0.5">
                      {t.thesis}
                    </p>
                  )}
                </div>

                {/* P&L + time */}
                <div className="shrink-0 text-right">
                  <PnlBadge pct={t.pnl_pct} status={t.status} />
                  <div className="text-[10px] text-[color:var(--muted)] mt-0.5" title={new Date(t.created_at).toLocaleString()}>
                    {timeAgo(t.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <button
          onClick={() => fetchTrades(trades.length)}
          className="mt-4 w-full rounded border border-[color:var(--border)] py-2 font-mono text-[11px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:border-[color:var(--accent)]/30 transition-colors"
        >
          Load more
        </button>
      )}

      <p className="mt-4 font-mono text-[9px] text-[color:var(--muted)] text-center">
        Past performance is not indicative of future results. Not financial advice.
      </p>
    </div>
    </KeyboardNav>
  );
}
