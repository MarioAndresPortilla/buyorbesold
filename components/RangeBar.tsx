import { formatPrice } from "@/lib/format";

interface RangeBarProps {
  low: number;
  high: number;
  current: number;
  label?: string;
}

export default function RangeBar({ low, high, current, label = "52W RANGE" }: RangeBarProps) {
  const safeLow = Number.isFinite(low) ? low : 0;
  const safeHigh = Number.isFinite(high) ? high : 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const span = Math.max(safeHigh - safeLow, 0.0001);
  const raw = ((safeCurrent - safeLow) / span) * 100;
  const pct = Math.max(0, Math.min(100, raw));

  return (
    <div className="w-full select-none">
      <div className="relative h-2 w-full rounded-full bg-[color:var(--border)]/70 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[color:var(--accent)]/60 to-[color:var(--accent)]"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:var(--accent)] bg-[color:var(--surface)] shadow"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
        <span>{formatPrice(safeLow, { currency: false })}</span>
        <span>{label}</span>
        <span>{formatPrice(safeHigh, { currency: false })}</span>
      </div>
    </div>
  );
}
