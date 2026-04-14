import type { Trade } from "@/lib/types";
import { formatPrice } from "@/lib/format";

interface MonthlyPnlProps {
  trades: Trade[];
  months?: number;
}

/**
 * Monthly P&L bar chart. Groups closed trades by YYYY-MM of exit date,
 * renders as vertical bars (green positive, red negative). Last N months.
 */
export default function MonthlyPnl({ trades, months = 12 }: MonthlyPnlProps) {
  const closed = trades.filter(
    (t) => t.status === "closed" && typeof t.pnl === "number" && t.exitDate
  );

  // Build an array of (YYYY-MM, pnl) for the last N months ending this month.
  const now = new Date();
  const buckets: Array<{ key: string; label: string; pnl: number; count: number }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    buckets.push({ key, label, pnl: 0, count: 0 });
  }

  for (const t of closed) {
    const key = t.exitDate!.slice(0, 7); // YYYY-MM
    const b = buckets.find((x) => x.key === key);
    if (b) {
      b.pnl += t.pnl ?? 0;
      b.count += 1;
    }
  }

  const totalPnl = buckets.reduce((a, b) => a + b.pnl, 0);
  const maxAbs = Math.max(1, ...buckets.map((b) => Math.abs(b.pnl)));
  const isPositive = totalPnl >= 0;

  const height = 160;
  const width = 800;
  const pad = { top: 10, right: 12, bottom: 24, left: 12 };
  const innerH = height - pad.top - pad.bottom;
  const zeroY = pad.top + innerH / 2;
  const barW = (width - pad.left - pad.right) / buckets.length;

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 xs:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Monthly P&amp;L
          </div>
          <div
            className="mt-1 font-bebas text-3xl leading-none"
            style={{ color: isPositive ? "var(--up)" : "var(--down)" }}
          >
            {isPositive ? "+" : ""}
            {formatPrice(totalPnl)}
          </div>
        </div>
        <div className="text-right font-mono text-[10px] text-[color:var(--muted)]">
          Last {months} months
        </div>
      </div>

      {buckets.every((b) => b.count === 0) ? (
        <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-[color:var(--border)] bg-black/10">
          <p className="text-[12px] text-[color:var(--muted)]">No closed trades in this window</p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" role="img">
          {/* Zero line */}
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={zeroY}
            y2={zeroY}
            stroke="currentColor"
            strokeOpacity="0.2"
            className="text-[color:var(--muted)]"
          />
          {buckets.map((b, i) => {
            const bx = pad.left + i * barW + barW * 0.15;
            const bw = barW * 0.7;
            const heightPx = (Math.abs(b.pnl) / maxAbs) * (innerH / 2 - 4);
            const by = b.pnl >= 0 ? zeroY - heightPx : zeroY;
            const barColor = b.pnl >= 0 ? "#22c55e" : b.pnl < 0 ? "#ef4444" : "transparent";
            const labelY = b.pnl >= 0 ? zeroY + 16 : zeroY - 6;
            return (
              <g key={b.key}>
                {b.count > 0 && (
                  <rect
                    x={bx}
                    y={by}
                    width={bw}
                    height={Math.max(2, heightPx)}
                    fill={barColor}
                    fillOpacity="0.7"
                    rx="2"
                  >
                    <title>
                      {b.label}: {b.pnl >= 0 ? "+" : ""}
                      {formatPrice(b.pnl)} ({b.count} trades)
                    </title>
                  </rect>
                )}
                <text
                  x={bx + bw / 2}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="monospace"
                  className="fill-[color:var(--muted)]"
                >
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
