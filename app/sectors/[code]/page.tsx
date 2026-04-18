import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { arrow, formatPct, formatPrice, formatTime } from "@/lib/format";
import {
  fetchSectorBreakdown,
  getSectorMeta,
  SECTORS,
  type SectorMoverRow,
} from "@/lib/sectors";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateStaticParams() {
  return SECTORS.map((s) => ({ code: s.code }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const meta = getSectorMeta(code);
  if (!meta) return { title: "Sector not found" };
  return {
    title: `${meta.name} sector — hottest, coldest, setups`,
    description: `${meta.name} (${meta.symbol}) sector breakdown: top gainers, top losers, and setup candidates from the top names. Not financial advice.`,
    alternates: { canonical: `/sectors/${meta.code}` },
  };
}

export default async function SectorPage({ params }: PageProps) {
  const { code } = await params;
  const breakdown = await fetchSectorBreakdown(code);
  if (!breakdown) notFound();

  const { meta, sectorChange, rows, scannedAt } = breakdown;
  const hottest = rows.slice(0, 5);
  const coldest = rows.slice(-5).reverse();

  // "Best opportunities" = names bouncing off a 52w low (deep value) or
  // pushing into the high with strong momentum — the two ends of the
  // range readers actually trade. Pulled out of the same list so we don't
  // need a separate API call.
  const opportunities = [...rows]
    .map((r) => ({ ...r, score: scoreOpportunity(r) }))
    .sort((a, b) => b.score - a.score)
    .filter((r) => r.score > 0)
    .slice(0, 5);

  const sectorChangePct = sectorChange?.changePct ?? 0;
  const accent = sectorChangePct >= 0 ? "var(--up)" : "var(--down)";

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[1100px]" />
      <Breadcrumbs
        maxWidth="max-w-[1100px]"
        items={[
          { href: "/", label: "Home" },
          { href: "/dashboard", label: "Dashboard" },
          { label: meta.name },
        ]}
      />

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 xs:py-10">
        <section className="flex flex-col gap-3 xs:flex-row xs:items-end xs:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
              Sector · {meta.symbol} · {formatTime(scannedAt)}
            </div>
            <h1 className="font-bebas text-[44px] leading-none tracking-wide xs:text-5xl sm:text-6xl">
              {meta.name}
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)] xs:text-[14px]">
              {meta.blurb}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Sector ETF
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-bebas text-3xl tracking-wide">
                {meta.symbol}
              </span>
              <span
                className="font-mono text-[13px] font-semibold"
                style={{ color: accent }}
              >
                {arrow(sectorChangePct)} {formatPct(sectorChangePct)}
              </span>
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-10 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
            No live data for this sector right now — try again in a minute.
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <MoversPanel
                title="Hottest names"
                subtitle="Leading the sector today"
                rows={hottest}
                kind="long"
              />
              <MoversPanel
                title="Coldest names"
                subtitle="Weighing on the sector today"
                rows={coldest}
                kind="short"
              />
            </div>

            <OpportunityPanel rows={opportunities} />
          </>
        )}

        <SiteFooter sub="Cached 5 min · Data: Yahoo Finance · Not financial advice." />
      </main>
    </div>
  );
}

function scoreOpportunity(r: SectorMoverRow): number {
  // Two readable setups per sector:
  //   (a) near 52w low + bouncing green  -> potential reversal
  //   (b) near 52w high + still green    -> breakout follow-through
  // Everything else scores 0 so it doesn't pollute the list.
  if (r.rangePos === null) return 0;
  if (r.rangePos <= 0.2 && r.changePct > 1) return 5 + r.changePct;
  if (r.rangePos >= 0.9 && r.changePct > 0) return 3 + r.changePct;
  return 0;
}

function MoversPanel({
  title,
  subtitle,
  rows,
  kind,
}: {
  title: string;
  subtitle: string;
  rows: SectorMoverRow[];
  kind: "long" | "short";
}) {
  const accent = kind === "long" ? "var(--up)" : "var(--down)";
  if (!rows.length) return null;
  return (
    <section>
      <div className="mb-2">
        <h2 className="font-bebas text-2xl tracking-wide xs:text-3xl">
          <span style={{ color: accent }}>▸</span> {title}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
          {subtitle}
        </p>
      </div>
      <div className="divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
        {rows.map((r) => (
          <MoverRow key={r.symbol} row={r} />
        ))}
      </div>
    </section>
  );
}

function MoverRow({ row }: { row: SectorMoverRow }) {
  const up = row.changePct >= 0;
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <a
      href={`https://finance.yahoo.com/quote/${encodeURIComponent(row.symbol)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[color:var(--surface-2)]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bebas text-xl leading-none tracking-wide text-[color:var(--text)]">
            {row.symbol}
          </span>
          {row.name && (
            <span className="truncate font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
              {row.name}
            </span>
          )}
        </div>
        {row.rangePos !== null && (
          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[color:var(--muted)]">
            <span className="relative h-1 w-24 overflow-hidden rounded bg-[color:var(--border)]/80">
              <span
                className="absolute top-0 h-full"
                style={{
                  left: `calc(${Math.round(row.rangePos * 100)}% - 2px)`,
                  width: 4,
                  background: color,
                  boxShadow: `0 0 4px ${color}`,
                }}
              />
            </span>
            <span>52W {Math.round(row.rangePos * 100)}%</span>
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-semibold text-[color:var(--text)]">
          {formatPrice(row.price)}
        </div>
        <div
          className="font-mono text-[11px] font-semibold"
          style={{ color }}
        >
          {arrow(row.changePct)} {formatPct(row.changePct)}
        </div>
      </div>
    </a>
  );
}

function OpportunityPanel({ rows }: { rows: SectorMoverRow[] }) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="font-bebas text-2xl tracking-wide xs:text-3xl">
          <span className="text-[color:var(--accent)]">▸</span> Best opportunities
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
          Names at range extremes — reversals off the low, breakouts near the high
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-8 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
          Nothing setting up in this sector right now — check back later
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.symbol}
              className="relative overflow-hidden rounded-xl border border-[color:var(--accent)]/30 bg-[color:var(--surface)] p-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-bebas text-2xl leading-none tracking-wide">
                  {r.symbol}
                </span>
                <span
                  className="font-mono text-[12px] font-semibold"
                  style={{
                    color: r.changePct >= 0 ? "var(--up)" : "var(--down)",
                  }}
                >
                  {arrow(r.changePct)} {formatPct(r.changePct)}
                </span>
              </div>
              {r.name && (
                <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                  {r.name}
                </div>
              )}
              <div className="mt-3 border-t border-[color:var(--border)]/60 pt-2 font-mono text-[10px] text-[color:var(--muted)]">
                {r.rangePos !== null && r.rangePos >= 0.9
                  ? "52W HIGH BREAKOUT"
                  : "52W LOW REVERSAL"}
                <span className="ml-2 text-[color:var(--text)]">
                  {formatPrice(r.price)}
                </span>
              </div>
              <div className="mt-3 flex gap-2 border-t border-[color:var(--border)]/60 pt-2 font-mono text-[10px] uppercase tracking-wider">
                <Link
                  href={`https://finance.yahoo.com/quote/${encodeURIComponent(r.symbol)}`}
                  target="_blank"
                  className="text-[color:var(--accent)] hover:underline"
                >
                  Yahoo ↗
                </Link>
                <Link
                  href={`https://www.tradingview.com/symbols/${encodeURIComponent(r.symbol)}/`}
                  target="_blank"
                  className="text-[color:var(--accent)] hover:underline"
                >
                  TV ↗
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
