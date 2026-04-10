import { arrow, formatPct, formatPrice } from "@/lib/format";
import type { Ticker } from "@/lib/types";

interface TickerTapeProps {
  tickers: Ticker[];
}

export default function TickerTape({ tickers }: TickerTapeProps) {
  if (!tickers.length) return null;
  // Duplicate the list so the translateX(-50%) animation loops seamlessly.
  const doubled = [...tickers, ...tickers];

  return (
    <div className="w-full overflow-hidden border-y border-[color:var(--border)] bg-[#0a0a0a]">
      <div className="flex animate-tape whitespace-nowrap py-2.5">
        {doubled.map((t, idx) => {
          const up = t.changePct >= 0;
          return (
            <div
              key={`${t.symbol}-${idx}`}
              className="mx-6 inline-flex items-center gap-2 font-mono text-xs"
            >
              <span className="font-semibold text-[color:var(--accent)]">
                {t.symbol}
              </span>
              <span className="text-white">{formatPrice(t.price)}</span>
              <span
                className="font-bold"
                style={{ color: up ? "#22c55e" : "#ef4444" }}
              >
                {arrow(t.changePct)} {formatPct(t.changePct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
