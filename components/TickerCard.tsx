import { arrow, formatPct, formatPrice } from "@/lib/format";
import type { Ticker } from "@/lib/types";
import RangeBar from "./RangeBar";
import Sparkline from "./Sparkline";

interface TickerCardProps {
  ticker: Ticker;
  label?: string;
}

export default function TickerCard({ ticker, label }: TickerCardProps) {
  const up = ticker.changePct >= 0;

  return (
    <div
      className="relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
      data-up={up}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: up ? "var(--up)" : "var(--down)" }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)] xs:text-[11px]">
            {label ?? ticker.name ?? "ASSET"}
          </div>
          <div className="font-mono text-sm font-semibold text-[color:var(--text)]">
            {ticker.symbol}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold xs:text-[11px]"
          style={{
            color: up ? "var(--up)" : "var(--down)",
            background: up
              ? "color-mix(in oklab, var(--up) 14%, transparent)"
              : "color-mix(in oklab, var(--down) 14%, transparent)",
          }}
        >
          {arrow(ticker.changePct)} {formatPct(ticker.changePct)}
        </span>
      </div>

      <div className="font-bebas text-[32px] leading-none tracking-wide text-[color:var(--text)] xs:text-4xl">
        {formatPrice(ticker.price)}
      </div>

      <Sparkline data={ticker.history} up={up} height={52} className="w-full" />

      <RangeBar low={ticker.low52} high={ticker.high52} current={ticker.price} />

      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border)]/60 pt-2 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
        <span className="truncate">VOL {ticker.volume ?? "—"}</span>
        <span className="truncate text-right">
          {ticker.mktcap
            ? `MCAP $${(ticker.mktcap / 1e9).toFixed(1)}B`
            : "SPOT"}
        </span>
      </div>
    </div>
  );
}
