"use client";

import { useMemo, useState } from "react";
import type { MacroEvent } from "@/lib/types";

const DEFAULT_EVENTS: MacroEvent[] = [
  {
    day: "MON",
    time: "10:00 ET",
    name: "Wholesale Inventories",
    previous: "0.5%",
    estimate: "0.3%",
    impact: "LOW",
  },
  {
    day: "TUE",
    time: "08:30 ET",
    name: "PPI (Core, MoM)",
    previous: "0.2%",
    estimate: "0.2%",
    impact: "MED",
  },
  {
    day: "WED",
    time: "08:30 ET",
    name: "CPI (Headline, YoY)",
    previous: "3.1%",
    estimate: "3.0%",
    impact: "HIGH",
  },
  {
    day: "WED",
    time: "14:00 ET",
    name: "FOMC Minutes",
    previous: "—",
    estimate: "—",
    impact: "HIGH",
  },
  {
    day: "THU",
    time: "08:30 ET",
    name: "Initial Jobless Claims",
    previous: "219K",
    estimate: "225K",
    impact: "MED",
  },
  {
    day: "FRI",
    time: "10:00 ET",
    name: "U. Michigan Sentiment",
    previous: "77.2",
    estimate: "78.0",
    impact: "LOW",
  },
];

const PAGE_SIZE = 10;

interface MacroCalendarProps {
  events?: MacroEvent[];
}

function impactClasses(impact: MacroEvent["impact"]): string {
  if (impact === "HIGH") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (impact === "MED") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
}

/**
 * "Apr 10" from a YYYY-MM-DD string. Kept locale-fixed so the short
 * month label doesn't drift between SSR and client render.
 */
function formatMonthDay(yyyyMmDd?: string): string | null {
  if (!yyyyMmDd) return null;
  const parts = yyyyMmDd.slice(0, 10).split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

export default function MacroCalendar({ events }: MacroCalendarProps) {
  const hasLive = !!events && events.length > 0;
  const list = useMemo(
    () => (hasLive ? events! : DEFAULT_EVENTS),
    [hasLive, events]
  );
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = list.slice(start, start + PAGE_SIZE);
  const rangeEnd = Math.min(start + PAGE_SIZE, list.length);

  return (
    <div>
      {!hasLive && (
        <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-amber-400">
          Sample calendar · set FINNHUB_API_KEY for live data
        </div>
      )}

      <div className="mb-2 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
        <span>
          {start + 1}–{rangeEnd} of {list.length}
        </span>
        {totalPages > 1 && (
          <span>
            Page {current} / {totalPages}
          </span>
        )}
      </div>

      <div className="divide-y divide-[color:var(--border)]">
        {visible.map((e, i) => {
          const monthDay = formatMonthDay(e.date);
          // The server sorts upcoming events (today + future) to the top,
          // so the first three rows of page 1 are exactly "what's next on
          // the tape". Tag them so the reader's eye lands there first.
          const isUpNext = current === 1 && i < 3;
          return (
            <div
              key={`${e.date ?? e.day}-${e.time}-${i}`}
              className={`relative flex items-start justify-between gap-3 py-3 font-mono text-[11px] ${
                isUpNext
                  ? "border-l-2 border-l-[color:var(--accent)] bg-[color:var(--accent)]/[0.04] pl-2"
                  : ""
              }`}
            >
              {/* Day badge */}
              <div className="flex w-14 shrink-0 flex-col items-start">
                <span className="font-bold text-[color:var(--accent)]">{e.day}</span>
                {monthDay && (
                  <span className="text-[9px] text-[color:var(--text)]">
                    {monthDay}
                  </span>
                )}
                <span className="text-[9px] text-[color:var(--muted)]">{e.time}</span>
              </div>

              {/* Event + meta (stacks on narrow, inlines on sm+) */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[color:var(--text)]">{e.name}</span>
                  {isUpNext && (
                    <span className="shrink-0 rounded-full border border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                      Up next
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-[color:var(--muted)]">
                  <span>prev {e.previous ?? "—"}</span>
                  <span>est {e.estimate ?? "—"}</span>
                </div>
              </div>

              {/* Impact badge */}
              <span
                className={`shrink-0 self-start rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${impactClasses(
                  e.impact
                )}`}
              >
                {e.impact}
              </span>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between border-t border-[color:var(--border)] pt-3">
          <PageButton
            label="← Prev"
            disabled={current === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          />
          <div className="flex flex-wrap items-center justify-center gap-1">
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === current ? "page" : undefined}
                className={`flex min-w-[2rem] items-center justify-center rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  n === current
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/20 text-[color:var(--accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <PageButton
            label="Next →"
            disabled={current === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      )}
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
        disabled
          ? "cursor-not-allowed border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--subtle)] opacity-50"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
      }`}
    >
      {label}
    </button>
  );
}
