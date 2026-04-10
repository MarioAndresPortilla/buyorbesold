import Link from "next/link";
import type { Brief, MarketData } from "@/lib/types";
import { formatPct, formatPrice } from "@/lib/format";

interface DailyBriefProps {
  brief: Brief;
  market?: MarketData;
  compact?: boolean;
}

export default function DailyBrief({ brief, market, compact = false }: DailyBriefProps) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent)]">
          Daily Brief
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
          {brief.date}
        </span>
      </div>

      <h2 className="font-bebas text-3xl leading-tight tracking-wide text-[color:var(--text)] sm:text-4xl">
        {brief.title}
      </h2>

      <p className="text-[15px] leading-relaxed text-[color:var(--muted)]">
        {brief.summary}
      </p>

      {!compact && (
        <div className="rounded-lg border border-[color:var(--border)]/70 bg-black/20 p-4 text-[14px] leading-relaxed text-[color:var(--text)]">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Mario's take
          </div>
          {brief.take}
        </div>
      )}

      {market && (
        <div className="grid grid-cols-3 gap-3 border-t border-[color:var(--border)]/60 pt-4">
          <MiniMetric label="DXY" value={formatPrice(market.dxy.price, { currency: false })} delta={market.dxy.changePct} />
          <MiniMetric label="10Y Yield" value={`${market.tnx.price.toFixed(2)}%`} delta={market.tnx.changePct} />
          <MiniMetric
            label="BTC Dom"
            value={
              market.bitcoin.mktcap
                ? `${((market.bitcoin.mktcap / 2.5e12) * 100).toFixed(1)}%`
                : "—"
            }
            delta={market.bitcoin.changePct}
          />
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-[color:var(--border)]/60 pt-4">
        <Link
          href={`/briefings/${brief.slug}`}
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)] hover:underline"
        >
          Read full brief →
        </Link>
        <span className="font-mono text-[10px] italic text-[color:var(--muted)]">
          Not financial advice.
        </span>
      </div>
    </article>
  );
}

function MiniMetric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number;
}) {
  const up = delta >= 0;
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold text-[color:var(--text)]">
        {value}
      </div>
      <div
        className="font-mono text-[10px]"
        style={{ color: up ? "var(--up)" : "var(--down)" }}
      >
        {formatPct(delta)}
      </div>
    </div>
  );
}
