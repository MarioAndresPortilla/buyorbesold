import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import CongressLeaderboard from "@/components/CongressLeaderboard";

export const metadata: Metadata = {
  title: "Congress Trade Monitor",
  description:
    "Who in Congress is beating the market? Daily STOCK Act disclosures, ranked by 30-day alpha vs the S&P 500. Not financial advice.",
};

export default function CongressPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-3 py-6 xs:px-4">
        <header className="mb-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-bebas text-2xl tracking-wider">
              Congress Trade Monitor
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
              Nightly sync · STOCK Act disclosures
            </span>
          </div>
          <p className="mt-3 max-w-[720px] text-sm text-[color:var(--muted)]">
            Ranked by <strong className="text-[color:var(--text)]">timing alpha</strong>
            {" "}— the difference between a member&rsquo;s trade-weighted return and the
            S&amp;P 500 over the same 30- or 90-day window. Positive alpha means the
            member beat the market on the trades they disclosed.
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
            Not financial advice. STOCK Act data is reported with a 30–45 day lag.
          </p>
        </header>

        <CongressLeaderboard />
      </main>
      <SiteFooter sub="Data: Finnhub STOCK Act feed · Baseline: S&P 500 (SPY) · Rebuilt nightly" />
    </>
  );
}
