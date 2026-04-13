import type { Metadata } from "next";
import Link from "next/link";
import { isKvAvailable, loadScannerArchive } from "@/lib/kv";
import SiteNav from "@/components/SiteNav";
import { arrow, formatPct, formatPrice } from "@/lib/format";
import type { SetupCandidate } from "@/lib/types";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Scanner Archive",
  description:
    "Historical scanner snapshots: what small-cap setups the BuyOrBeSold day trader scanner flagged on each day. Not financial advice.",
  alternates: { canonical: "/scanner/history" },
};

export default async function ScannerHistoryPage() {
  const kvOn = isKvAvailable();
  const archive = kvOn ? await loadScannerArchive(14) : [];

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[1000px]" links={[{href: "/scanner", label: "Scanner"}, {href: "/dashboard", label: "Dashboard", short: "Dash"}]} />

      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-10 xs:py-12">
        <div>
          <Link
            href="/scanner"
            className="font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--muted)] hover:text-[color:var(--accent)]"
          >
            ← Back to scanner
          </Link>
          <h1 className="mt-4 font-bebas text-[40px] leading-none tracking-wide xs:text-5xl">
            Scanner archive
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)] xs:text-[14px]">
            Historical snapshots of the day trader scanner — what was flagged,
            when, and at what price. Snapshots are captured on the first scanner
            request of each UTC day and kept for 30 days.
          </p>
        </div>

        {!kvOn && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 font-mono text-[12px] text-amber-400">
            <div className="font-bold uppercase tracking-wider">
              Archive requires Vercel KV
            </div>
            <div className="mt-2 text-[11px] leading-relaxed">
              The scanner archive reads from Vercel KV. Provision a KV store
              under your Vercel project and redeploy — snapshots will start
              being captured automatically on the first scanner request of
              each day.
            </div>
          </div>
        )}

        {kvOn && archive.length === 0 && (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-10 text-center">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
              No snapshots yet
            </div>
            <div className="mt-2 text-[13px] text-[color:var(--muted)]">
              The archive will populate after the next scanner run.
            </div>
          </div>
        )}

        {archive.map(({ date, result }) => (
          <section
            key={date}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--accent)]">
                  {date}
                </div>
                <h2 className="font-bebas text-2xl tracking-wide">
                  {result.topLongs.length + result.topShorts.length} setups ·{" "}
                  <span className="text-[color:var(--muted)]">
                    scanned {result.candidateCount} tickers
                  </span>
                </h2>
              </div>
              {result.degraded && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400">
                  Degraded (no float data)
                </span>
              )}
            </div>

            <ArchiveBlock label="Longs" items={result.topLongs} kind="long" />
            <ArchiveBlock label="Shorts" items={result.topShorts} kind="short" />
          </section>
        ))}
      </main>
    </div>
  );
}

function ArchiveBlock({
  label,
  items,
  kind,
}: {
  label: string;
  items: SetupCandidate[];
  kind: "long" | "short";
}) {
  const color = kind === "long" ? "var(--up)" : "var(--down)";
  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
        {label}
      </div>
      {items.length === 0 ? (
        <div className="font-mono text-[11px] text-[color:var(--muted)]">
          — none matched
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--border)]/70">
          {items.map((c, i) => (
            <div
              key={c.symbol}
              className="flex items-center gap-3 py-2 font-mono text-[11px]"
            >
              <span className="w-4 text-[color:var(--muted)]">{i + 1}</span>
              <span
                className="w-16 font-bebas text-lg leading-none"
                style={{ color }}
              >
                {c.symbol}
              </span>
              <div className="flex-1 truncate text-[color:var(--muted)]">
                {c.tags.join(" · ")}
              </div>
              <span className="text-[color:var(--text)]">
                {formatPrice(c.price)}
              </span>
              <span className="w-14 text-right" style={{ color }}>
                {arrow(c.changePct)} {formatPct(c.changePct)}
              </span>
              <a
                href={`https://finance.yahoo.com/quote/${encodeURIComponent(c.symbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-[color:var(--accent)] hover:underline"
              >
                ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
