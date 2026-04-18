"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { WatchlistEntry } from "@/lib/types";
import { arrow, formatPct, formatPrice } from "@/lib/format";

interface ApiResponse {
  entries: WatchlistEntry[];
  max: number;
}

type LoadState = "idle" | "loading" | "loaded" | "unauth" | "error";

export default function UserWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [max, setMax] = useState(10);
  const [state, setState] = useState<LoadState>("loading");
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist", { cache: "no-store" });
      if (res.status === 401) {
        setState("unauth");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      setEntries(data.entries);
      setMax(data.max);
      setState("loaded");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const symbol = input.trim().toUpperCase();
      if (!symbol) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            typeof data?.error === "string" ? data.error : "Could not add symbol."
          );
          return;
        }
        setEntries((data as ApiResponse).entries);
        setInput("");
      } catch {
        setError("Network error.");
      } finally {
        setSubmitting(false);
      }
    },
    [input]
  );

  const remove = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(
        `/api/watchlist?symbol=${encodeURIComponent(symbol)}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as ApiResponse;
      setEntries(data.entries);
    } catch {
      // ignore
    }
  }, []);

  if (state === "loading") {
    return (
      <Panel>
        <div className="py-6 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
          Loading your watchlist…
        </div>
      </Panel>
    );
  }

  if (state === "unauth") {
    return (
      <Panel>
        <div className="flex flex-col items-start gap-2 py-4">
          <p className="text-[13px] leading-relaxed text-[color:var(--muted)]">
            Track up to 10 tickers with live price, %change, RVOL, and SMA
            distance.
          </p>
          <Link
            href="/login"
            className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black"
          >
            Log in to build your watchlist
          </Link>
        </div>
      </Panel>
    );
  }

  if (state === "error") {
    return (
      <Panel>
        <div className="py-4 font-mono text-[11px] text-red-400">
          Couldn't load your watchlist. Refresh to try again.
        </div>
      </Panel>
    );
  }

  const atCap = entries.length >= max;

  return (
    <Panel count={entries.length} max={max}>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(ev) => setInput(ev.target.value.toUpperCase())}
          placeholder="Add ticker (e.g. NVDA)"
          maxLength={16}
          disabled={atCap || submitting}
          className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 font-mono text-[12px] uppercase tracking-wider text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={atCap || submitting || !input.trim()}
          className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black disabled:opacity-50"
        >
          {submitting ? "…" : "Add"}
        </button>
      </form>

      {error && (
        <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </div>
      )}

      {atCap && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-[11px] text-amber-400">
          Watchlist full — remove one to add another. (Max {max}.)
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
          Add your first ticker to start tracking
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--border)] rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]">
          {entries.map((e) => (
            <Row key={e.symbol} entry={e} onRemove={() => remove(e.symbol)} />
          ))}
        </div>
      )}

      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
        Not financial advice. Sources: Yahoo Finance.
      </p>
    </Panel>
  );
}

function Panel({
  children,
  count,
  max,
}: {
  children: React.ReactNode;
  count?: number;
  max?: number;
}) {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-bebas text-2xl tracking-wide xs:text-3xl">
            <span className="text-[color:var(--accent)]">▸</span> Your watchlist
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            Personal picks — live Yahoo prices
          </p>
        </div>
        {typeof count === "number" && typeof max === "number" && (
          <span className="font-mono text-[11px] text-[color:var(--muted)]">
            {count}/{max}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({
  entry,
  onRemove,
}: {
  entry: WatchlistEntry;
  onRemove: () => void;
}) {
  const up = entry.changePct >= 0;
  const color = up ? "var(--up)" : "var(--down)";

  // Show the extended-hours line when Yahoo is reporting a pre or post
  // price. We key off marketState first, then fall back to whichever
  // price is present — some tickers don't get a clean state label.
  const state = entry.marketState;
  const preActive =
    (state === "PRE" || state === "PREPRE") && entry.preMarketPrice !== undefined;
  const postActive =
    (state === "POST" || state === "POSTPOST" || state === "CLOSED") &&
    entry.postMarketPrice !== undefined;
  const extLabel = preActive ? "PRE" : postActive ? "AH" : null;
  const extPrice = preActive
    ? entry.preMarketPrice
    : postActive
    ? entry.postMarketPrice
    : undefined;
  const extChange = preActive
    ? entry.preMarketChangePct
    : postActive
    ? entry.postMarketChangePct
    : undefined;
  const extColor =
    extChange !== undefined && extChange < 0 ? "var(--down)" : "var(--up)";

  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bebas text-xl leading-none tracking-wide text-[color:var(--text)]">
              {entry.symbol}
            </span>
            {entry.name && (
              <span className="truncate font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                {entry.name}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] text-[color:var(--muted)]">
            <span>RVOL {entry.rvol.toFixed(1)}x</span>
            {entry.sma50Delta !== undefined && (
              <span>
                50 SMA {entry.sma50Delta >= 0 ? "+" : ""}
                {entry.sma50Delta.toFixed(1)}%
              </span>
            )}
            {entry.sma200Delta !== undefined && (
              <span>
                200 SMA {entry.sma200Delta >= 0 ? "+" : ""}
                {entry.sma200Delta.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-sm font-semibold text-[color:var(--text)]">
              {formatPrice(entry.price)}
            </div>
            <div
              className="font-mono text-[11px] font-semibold"
              style={{ color }}
            >
              {arrow(entry.changePct)} {formatPct(entry.changePct)}
            </div>
            {extLabel && extPrice !== undefined && (
              <div
                className="mt-0.5 font-mono text-[10px]"
                style={{ color: extColor }}
              >
                <span className="text-[color:var(--muted)]">{extLabel}</span>{" "}
                {formatPrice(extPrice)}
                {extChange !== undefined && (
                  <> {arrow(extChange)} {formatPct(extChange)}</>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${entry.symbol}`}
            className="rounded-md border border-[color:var(--border)] px-2 py-1 font-mono text-[10px] text-[color:var(--muted)] transition-colors hover:border-red-500/60 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
