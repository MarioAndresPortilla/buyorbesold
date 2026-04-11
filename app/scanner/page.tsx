import type { Metadata } from "next";
import Link from "next/link";
import { runScanner } from "@/lib/scanner";
import type { SetupCandidate } from "@/lib/types";
import { arrow, formatPct, formatPrice, formatTime, formatCompact } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Day Trader Scanner",
  description:
    "Live small-cap day trading scanner: float under 20M, RVOL > 1.5x, bouncing off the 50 or 200-day moving average. Top 3 longs and top 3 shorts of the day. Not financial advice.",
  alternates: { canonical: "/scanner" },
  openGraph: {
    title: "Day Trader Scanner — BuyOrBeSold",
    description:
      "Top 3 long + top 3 short small-cap setups of the day. Low float, high relative volume, MA bounce.",
    type: "website",
  },
};

export default async function ScannerPage() {
  const scan = await runScanner();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-2 px-3 py-3 xs:gap-3 xs:px-4 xs:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 xs:gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)] xs:h-9 xs:w-9 xs:text-lg">
              B/S
            </span>
            <span className="truncate font-bebas text-lg tracking-wider xs:text-xl">
              BUYORBESOLD
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)] xs:gap-4 xs:text-[11px] xs:tracking-[0.15em]">
            <Link href="/dashboard" className="hover:text-[color:var(--accent)]">
              Dash<span className="hidden xs:inline">board</span>
            </Link>
            <Link href="/briefings" className="hover:text-[color:var(--accent)]">
              Briefs
            </Link>
            <Link href="/newsletter" className="hidden hover:text-[color:var(--accent)] xs:inline">
              Newsletter
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-8 xs:py-10">
        {/* Title row */}
        <section className="flex flex-col gap-3 xs:flex-row xs:items-end xs:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--accent)]" />
              </span>
              Live scanner · {formatTime(scan.scannedAt)}
            </div>
            <h1 className="font-bebas text-[44px] leading-none tracking-wide xs:text-5xl sm:text-6xl">
              Today's setups
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)] xs:text-[14px]">
              Top 3 long + top 3 short small-cap candidates matching my day-trade filter.
              Scanned {scan.candidateCount} tickers, {scan.qualifiedCount} passed.
            </p>
          </div>
          <CriteriaCard criteria={scan.criteria} />
        </section>

        {/* Notes / degraded warnings */}
        {scan.notes.length > 0 && (
          <div
            className={`rounded-md border px-4 py-3 font-mono text-[11px] ${
              scan.degraded
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)]"
            }`}
          >
            {scan.notes.map((n, i) => (
              <div key={i}>• {n}</div>
            ))}
          </div>
        )}

        {/* Long setups */}
        <SetupPanel
          title="Top 3 Long Setups"
          subtitle="Matching criteria, positive day"
          candidates={scan.topLongs}
          kind="long"
        />

        {/* Short setups */}
        <SetupPanel
          title="Top 3 Short Setups"
          subtitle="Matching criteria, negative day"
          candidates={scan.topShorts}
          kind="short"
        />

        {/* Methodology */}
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <h3 className="font-bebas text-xl tracking-wide">How the scanner works</h3>
          <ol className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-[color:var(--muted)]">
            <li>
              1. Pulls the Yahoo most-actives, day-gainers, and day-losers screens
              ({scan.candidateCount} tickers today).
            </li>
            <li>
              2. Filters to price ${scan.criteria.priceMin}–${scan.criteria.priceMax}, caps at
              the 30 highest-momentum survivors (|change| × log(volume)).
            </li>
            <li>
              3. Fetches 1 year of daily bars from Yahoo, computes SMA-50, SMA-200, and 10-day
              average volume for RVOL.
            </li>
            <li>
              4. Queries Finnhub for float on each survivor (requires FINNHUB_API_KEY).
            </li>
            <li>
              5. Keeps only stocks bouncing within {(scan.criteria.smaBouncePct * 100).toFixed(0)}%
              of the 50 or 200 SMA, with RVOL ≥ {scan.criteria.minRvol}x, and float under{" "}
              {(scan.criteria.maxFloat / 1e6).toFixed(0)}M.
            </li>
            <li>
              6. Scores by {"{setup match, RVOL strength, float size, |day change|}"} and returns
              the top 3 longs and shorts.
            </li>
          </ol>
          <p className="mt-4 text-[11px] italic text-[color:var(--muted)]">
            Not financial advice. Do your own research. This is a pattern scanner, not a trade
            recommendation.
          </p>
        </section>

        <footer className="flex flex-col items-center gap-2 border-t border-[color:var(--border)] pt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hover:text-[color:var(--accent)]">
              Dashboard
            </Link>
            <Link href="/briefings" className="hover:text-[color:var(--accent)]">
              Briefings
            </Link>
            <a href="/rss.xml" className="hover:text-[color:var(--accent)]">
              RSS
            </a>
          </div>
          <div>Cached 5 min · Data: Yahoo Finance, Finnhub · Not financial advice.</div>
        </footer>
      </main>
    </div>
  );
}

function CriteriaCard({
  criteria,
}: {
  criteria: {
    priceMin: number;
    priceMax: number;
    maxFloat: number;
    minRvol: number;
    smaBouncePct: number;
  };
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
        Filter
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
        <span className="text-[color:var(--muted)]">Price</span>
        <span className="text-right text-[color:var(--text)]">
          ${criteria.priceMin}–${criteria.priceMax}
        </span>
        <span className="text-[color:var(--muted)]">Float</span>
        <span className="text-right text-[color:var(--text)]">
          &lt; {(criteria.maxFloat / 1e6).toFixed(0)}M
        </span>
        <span className="text-[color:var(--muted)]">RVOL</span>
        <span className="text-right text-[color:var(--text)]">
          ≥ {criteria.minRvol}x
        </span>
        <span className="text-[color:var(--muted)]">Setup</span>
        <span className="text-right text-[color:var(--text)]">
          50/200 SMA ±{(criteria.smaBouncePct * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function SetupPanel({
  title,
  subtitle,
  candidates,
  kind,
}: {
  title: string;
  subtitle: string;
  candidates: SetupCandidate[];
  kind: "long" | "short";
}) {
  const accent = kind === "long" ? "var(--up)" : "var(--down)";
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="font-bebas text-2xl tracking-wide xs:text-3xl">
            <span style={{ color: accent }}>▸</span> {title}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {subtitle}
          </p>
        </div>
      </div>
      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-8 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
          No {kind} setups matched today
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((c, i) => (
            <SetupCard key={c.symbol} rank={i + 1} candidate={c} kind={kind} />
          ))}
        </div>
      )}
    </section>
  );
}

function SetupCard({
  rank,
  candidate,
  kind,
}: {
  rank: number;
  candidate: SetupCandidate;
  kind: "long" | "short";
}) {
  const up = kind === "long";
  const accent = up ? "var(--up)" : "var(--down)";
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[10px] font-bold uppercase"
              style={{ color: accent }}
            >
              #{rank}
            </span>
            <span className="font-bebas text-2xl leading-none tracking-wide text-[color:var(--text)]">
              {candidate.symbol}
            </span>
          </div>
          {candidate.name && (
            <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
              {candidate.name}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-bebas text-2xl leading-none tracking-wide text-[color:var(--text)]">
            {formatPrice(candidate.price)}
          </div>
          <div
            className="font-mono text-[11px] font-semibold"
            style={{ color: accent }}
          >
            {arrow(candidate.changePct)} {formatPct(candidate.changePct)}
          </div>
        </div>
      </div>

      {/* Criteria chips */}
      <div className="flex flex-wrap gap-1.5">
        {candidate.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[color:var(--accent)]"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[color:var(--border)]/60 pt-3 font-mono text-[10px]">
        <Metric label="Float" value={candidate.float ? `${(candidate.float / 1e6).toFixed(1)}M` : "—"} />
        <Metric label="RVOL" value={`${candidate.rvol.toFixed(1)}x`} />
        <Metric label="Volume" value={formatCompact(candidate.volume)} />
        <Metric
          label="Avg Vol 10d"
          value={formatCompact(candidate.avgVol10d)}
        />
        <Metric
          label="SMA 50"
          value={candidate.sma50 ? `$${candidate.sma50.toFixed(2)}` : "—"}
        />
        <Metric
          label="SMA 200"
          value={candidate.sma200 ? `$${candidate.sma200.toFixed(2)}` : "—"}
        />
      </div>

      {/* External links */}
      <div className="flex gap-2 border-t border-[color:var(--border)]/60 pt-3 font-mono text-[10px] uppercase tracking-wider">
        <a
          href={`https://finance.yahoo.com/quote/${encodeURIComponent(candidate.symbol)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--accent)] hover:underline"
        >
          Yahoo ↗
        </a>
        <a
          href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(candidate.symbol)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--accent)] hover:underline"
        >
          Finviz ↗
        </a>
        <a
          href={`https://www.tradingview.com/symbols/${encodeURIComponent(candidate.symbol)}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--accent)] hover:underline"
        >
          TV ↗
        </a>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-[color:var(--muted)]">{label}</span>
      <span className="text-right text-[color:var(--text)]">{value}</span>
    </>
  );
}
