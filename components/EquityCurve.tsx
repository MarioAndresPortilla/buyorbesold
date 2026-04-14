import type { Trade } from "@/lib/types";
import { formatPrice } from "@/lib/format";

interface EquityCurveProps {
  trades: Trade[];
  height?: number;
}

/**
 * Cumulative P&L line chart — shows the user's equity curve over time.
 * Server component, pure SVG, no dependencies.
 *
 * Closed trades only. Sorted by exit date. Each point is cumulative pnl.
 * Line color tints green when net positive, red when net negative.
 */
export default function EquityCurve({ trades, height = 180 }: EquityCurveProps) {
  const closed = trades
    .filter((t) => t.status === "closed" && typeof t.pnl === "number" && t.exitDate)
    .sort((a, b) =>
      (a.exitDate ?? "").localeCompare(b.exitDate ?? "")
    );

  if (closed.length < 2) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
            Equity curve
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--muted)]">
            {closed.length === 0
              ? "No closed trades yet"
              : "Need 2+ closed trades"}
          </p>
        </div>
      </div>
    );
  }

  // Build cumulative series
  let cumulative = 0;
  const points = closed.map((t) => {
    cumulative += t.pnl ?? 0;
    return { date: t.exitDate!, value: cumulative };
  });

  const min = Math.min(0, ...points.map((p) => p.value));
  const max = Math.max(0, ...points.map((p) => p.value));
  const range = max - min || 1;
  const finalValue = points[points.length - 1].value;
  const isPositive = finalValue >= 0;
  const color = isPositive ? "var(--up)" : "var(--down)";
  const colorRaw = isPositive ? "#22c55e" : "#ef4444";

  // SVG dimensions — use viewBox so it scales
  const width = 800;
  const pad = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  // Coordinate helpers
  const x = (i: number) => pad.left + (i / (points.length - 1)) * innerW;
  const y = (val: number) =>
    pad.top + innerH - ((val - min) / range) * innerH;

  // Build paths
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(2)} ${y(0).toFixed(2)} L ${x(0).toFixed(2)} ${y(0).toFixed(2)} Z`;

  // Zero line
  const zeroY = y(0);
  const showZeroLine = min < 0 && max > 0;

  // First + last labels
  const firstDate = new Date(points[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const lastDate = new Date(points[points.length - 1].date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 xs:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Equity curve
          </div>
          <div className="mt-1 font-bebas text-3xl leading-none" style={{ color }}>
            {isPositive ? "+" : ""}
            {formatPrice(finalValue)}
          </div>
        </div>
        <div className="text-right font-mono text-[10px] text-[color:var(--muted)]">
          {closed.length} closed trades
          <br />
          {firstDate} – {lastDate}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Equity curve: ${formatPrice(finalValue)} over ${closed.length} trades`}
      >
        <defs>
          <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorRaw} stopOpacity="0.25" />
            <stop offset="100%" stopColor={colorRaw} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Zero baseline */}
        {showZeroLine && (
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={zeroY}
            y2={zeroY}
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeDasharray="3 3"
            className="text-[color:var(--muted)]"
          />
        )}

        {/* Filled area under curve */}
        <path d={areaPath} fill="url(#equity-fill)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={colorRaw}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Final point */}
        <circle
          cx={x(points.length - 1)}
          cy={y(finalValue)}
          r="4"
          fill={colorRaw}
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(finalValue)}
          r="8"
          fill={colorRaw}
          fillOpacity="0.3"
        />

        {/* Y-axis labels */}
        <text x={pad.left - 6} y={pad.top + 4} textAnchor="end" fontSize="10" fontFamily="monospace" className="fill-[color:var(--muted)]">
          {formatPrice(max)}
        </text>
        {showZeroLine && (
          <text x={pad.left - 6} y={zeroY + 3} textAnchor="end" fontSize="10" fontFamily="monospace" className="fill-[color:var(--muted)]">
            $0
          </text>
        )}
        <text x={pad.left - 6} y={height - pad.bottom + 12} textAnchor="end" fontSize="10" fontFamily="monospace" className="fill-[color:var(--muted)]">
          {formatPrice(min)}
        </text>
      </svg>
    </div>
  );
}
