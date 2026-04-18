import Link from "next/link";
import type { Brief, MarketData } from "@/lib/types";
import { formatBriefDate, formatPct, formatPrice } from "@/lib/format";
import BriefBody from "./BriefBody";

interface DailyBriefProps {
  brief: Brief;
  market?: MarketData;
  compact?: boolean;
}

export default function DailyBrief({ brief, market, compact = false }: DailyBriefProps) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 xs:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent)]">
          Daily Brief
        </span>
        <time
          dateTime={brief.publishedAt ?? brief.date}
          className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]"
        >
          {formatBriefDate(brief)}
        </time>
      </div>

      <h2 className="font-bebas text-2xl leading-tight tracking-wide text-[color:var(--text)] xs:text-3xl sm:text-4xl">
        {brief.title}
      </h2>

      <p className="text-[14px] leading-relaxed text-[color:var(--muted)] xs:text-[15px]">
        {brief.summary}
      </p>

      {!compact && (
        <div className="rounded-lg border border-[color:var(--border)]/70 bg-black/20 p-4 text-[color:var(--text)]">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Mario's take
          </div>
          <BriefBody text={brief.take} />
        </div>
      )}

      {market && (
        <div className="grid grid-cols-3 gap-2 border-t border-[color:var(--border)]/60 pt-4 xs:gap-3">
          <MiniMetric
            label="DXY"
            value={formatPrice(market.dxy.price, { currency: false })}
            delta={market.dxy.changePct}
          />
          <MiniMetric
            label="10Y Yield"
            value={`${market.tnx.price.toFixed(2)}%`}
            delta={market.tnx.changePct}
          />
          <MiniMetric
            label="VIX"
            value={market.vix.price.toFixed(2)}
            delta={market.vix.changePct}
          />
          <MiniMetric
            label="BTC Dom"
            value={
              market.macro.btcDominance
                ? `${market.macro.btcDominance.toFixed(1)}%`
                : "—"
            }
          />
          <MiniMetric
            label="Crypto Cap"
            value={formatCryptoCap(market.macro.cryptoMktCap)}
            delta={market.macro.cryptoMktCapChangePct}
          />
          <MiniMetric
            label="Gold/Silver"
            value={
              market.silver.price
                ? (market.gold.price / market.silver.price).toFixed(1)
                : "—"
            }
            delta={market.gold.changePct - market.silver.changePct}
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
  delta?: number;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="min-w-0">
      <div className="truncate font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)] xs:text-[10px]">
        {label}
      </div>
      <div className="truncate font-mono text-[13px] font-semibold text-[color:var(--text)] xs:text-sm">
        {value}
      </div>
      {delta != null && (
        <div
          className="font-mono text-[10px]"
          style={{ color: up ? "var(--up)" : "var(--down)" }}
        >
          {formatPct(delta)}
        </div>
      )}
    </div>
  );
}

function formatCryptoCap(usd: number): string {
  if (!usd) return "—";
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(0)}B`;
  return `$${usd.toFixed(0)}`;
}
