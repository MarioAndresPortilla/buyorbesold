import type { Trade } from "@/lib/types";
import { formatPrice } from "@/lib/format";

interface TradeCalendarProps {
  trades: Trade[];
  /** How many weeks back to show. Default 26 = ~6 months. */
  weeks?: number;
}

/**
 * GitHub-style contribution heatmap for trading activity.
 * Each cell = one day. Color intensity scales with P&L:
 *   - Green for net positive days (darker = bigger win)
 *   - Red for net negative days
 *   - Dim gray for days with open trades only (activity, no P&L)
 *   - Empty for days with no trades
 */
export default function TradeCalendar({ trades, weeks = 26 }: TradeCalendarProps) {
  const days = weeks * 7;
  const now = new Date();
  // Align the end to last Saturday so the grid is clean columns.
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  // Build day buckets for the last `days` days.
  const buckets = new Map<string, { pnl: number; trades: number; opens: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    buckets.set(key, { pnl: 0, trades: 0, opens: 0 });
  }

  for (const t of trades) {
    // Count a trade on its exit date if closed, else on its entry date.
    const dateStr = t.status === "closed" ? t.exitDate?.slice(0, 10) : t.entryDate.slice(0, 10);
    if (!dateStr) continue;
    const b = buckets.get(dateStr);
    if (!b) continue;
    b.trades += 1;
    if (t.status === "closed" && typeof t.pnl === "number") {
      b.pnl += t.pnl;
    } else {
      b.opens += 1;
    }
  }

  // Build grid: 7 rows (Sun-Sat), N cols (weeks).
  // Most recent week is the rightmost column.
  const grid: Array<Array<{ date: string; data: typeof buckets extends Map<string, infer V> ? V : never } | null>> = [];
  for (let row = 0; row < 7; row++) grid.push([]);

  // Work backwards from end to fill columns right-to-left
  const allKeys = Array.from(buckets.keys()).sort();
  // Align to a fixed starting Sunday so column layout is stable
  const firstDate = new Date(allKeys[0]);
  const firstDow = firstDate.getDay();
  const prefix = firstDow; // empty cells at start of first column

  // Pad prefix with nulls
  for (let i = 0; i < prefix; i++) {
    grid[i].push(null);
  }

  let col = 0;
  for (const key of allKeys) {
    const d = new Date(key);
    const dow = d.getDay();
    grid[dow][grid[dow].length - (grid[dow][grid[dow].length - 1] === null ? 0 : 0)];
    grid[dow].push({ date: key, data: buckets.get(key)! });
    if (dow === 6) col++;
  }

  // Normalize: find each row's intended column count (max)
  const maxCols = Math.max(...grid.map((r) => r.length));
  for (const row of grid) {
    while (row.length < maxCols) row.push(null);
  }

  // Compute color scale
  const pnls = Array.from(buckets.values()).map((b) => b.pnl).filter((p) => p !== 0);
  const maxPnl = Math.max(1, ...pnls.filter((p) => p > 0));
  const minPnl = Math.min(-1, ...pnls.filter((p) => p < 0));

  function cellColor(data: { pnl: number; trades: number; opens: number }): string {
    if (data.trades === 0) return "transparent";
    if (data.pnl === 0 && data.opens > 0) return "color-mix(in oklab, var(--accent) 20%, transparent)";
    if (data.pnl > 0) {
      const intensity = Math.min(1, data.pnl / maxPnl);
      const pct = Math.round(15 + intensity * 70);
      return `color-mix(in oklab, var(--up) ${pct}%, transparent)`;
    }
    if (data.pnl < 0) {
      const intensity = Math.min(1, data.pnl / minPnl);
      const pct = Math.round(15 + intensity * 70);
      return `color-mix(in oklab, var(--down) ${pct}%, transparent)`;
    }
    return "transparent";
  }

  const totalDays = Array.from(buckets.values()).filter((b) => b.trades > 0).length;
  const totalPnl = Array.from(buckets.values()).reduce((a, b) => a + b.pnl, 0);

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 xs:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Activity
          </div>
          <div className="mt-1 font-bebas text-3xl leading-none text-[color:var(--text)]">
            {totalDays}
            <span className="ml-2 font-mono text-[11px] font-normal text-[color:var(--muted)]">
              trading days
            </span>
          </div>
        </div>
        <div className="text-right font-mono text-[10px] text-[color:var(--muted)]">
          Last {weeks} weeks
          <br />
          <span
            className="font-bold"
            style={{
              color: totalPnl > 0 ? "var(--up)" : totalPnl < 0 ? "var(--down)" : "var(--muted)",
            }}
          >
            {totalPnl >= 0 ? "+" : ""}
            {formatPrice(totalPnl)}
          </span>{" "}
          net
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-[3px]">
          {["Sun", "", "Tue", "", "Thu", "", "Sat"].map((_label, rowIdx) => (
            <div key={rowIdx} className="flex gap-[3px]">
              {grid[rowIdx].map((cell, colIdx) => {
                if (!cell) {
                  return <div key={colIdx} className="h-[11px] w-[11px]" />;
                }
                const bg = cellColor(cell.data);
                const tooltip =
                  cell.data.trades === 0
                    ? `${cell.date}: no trades`
                    : `${cell.date}: ${cell.data.trades} trade${cell.data.trades === 1 ? "" : "s"}, ${cell.data.pnl >= 0 ? "+" : ""}${formatPrice(cell.data.pnl)}${cell.data.opens > 0 ? ` (${cell.data.opens} open)` : ""}`;
                return (
                  <div
                    key={colIdx}
                    title={tooltip}
                    className="h-[11px] w-[11px] rounded-[2px] border border-[color:var(--border)]/40"
                    style={{
                      background: bg === "transparent" ? "color-mix(in oklab, var(--border) 30%, transparent)" : bg,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-2 font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
        <span>Less</span>
        <div className="flex gap-[2px]">
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "color-mix(in oklab, var(--border) 30%, transparent)" }}
          />
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "color-mix(in oklab, var(--up) 30%, transparent)" }}
          />
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "color-mix(in oklab, var(--up) 55%, transparent)" }}
          />
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "color-mix(in oklab, var(--up) 85%, transparent)" }}
          />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
