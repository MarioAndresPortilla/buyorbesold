import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import StockChart from "@/components/StockChart";
import { fetchChart, parseRange } from "@/lib/chart";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ range?: string }>;
}

function normalizeSymbol(raw: string): string | null {
  const sym = raw.trim().toUpperCase();
  if (!sym || sym.length > 16 || !/^[A-Z0-9.\-^]+$/.test(sym)) return null;
  return sym;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { symbol: raw } = await params;
  const symbol = normalizeSymbol(raw);
  if (!symbol) return { title: "Chart not found" };
  return {
    title: `${symbol} chart — price, volume, SMA context`,
    description: `Live ${symbol} price chart with candles and volume across 1D, 5D, 1M, 6M, 1Y, 5Y. Not financial advice.`,
    alternates: { canonical: `/chart/${symbol}` },
  };
}

export default async function ChartPage({ params, searchParams }: PageProps) {
  const { symbol: raw } = await params;
  const { range: rangeRaw } = await searchParams;
  const symbol = normalizeSymbol(raw);
  if (!symbol) notFound();

  const range = parseRange(rangeRaw);
  const initial = await fetchChart(symbol, range);
  if (!initial) notFound();

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-6 sm:px-6">
        <nav className="mb-4 font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
          <Link
            href="/dashboard"
            className="hover:text-[color:var(--text)]"
          >
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[color:var(--text)]">Chart</span>
          <span className="mx-2">/</span>
          <span>{symbol}</span>
        </nav>

        <StockChart symbol={symbol} initial={initial} />

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <LinkCard
            href={`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`}
            label="Yahoo Finance"
            hint="Quote · news · financials"
          />
          <LinkCard
            href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol)}`}
            label="Finviz"
            hint="Screener snapshot · short interest"
          />
          <LinkCard
            href={`https://www.tradingview.com/symbols/${encodeURIComponent(symbol)}/`}
            label="TradingView"
            hint="Full charting · indicators"
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function LinkCard({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 transition-colors hover:border-[color:var(--accent)]"
    >
      <div className="font-bebas text-lg tracking-wide text-[color:var(--text)]">
        {label} ↗
      </div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
        {hint}
      </div>
    </a>
  );
}
