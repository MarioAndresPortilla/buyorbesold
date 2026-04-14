import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import Leaderboard from "@/components/Leaderboard";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Top traders ranked by Sharpe ratio, profit factor, and risk-adjusted returns. Verified leaderboards with minimum trade requirements.",
};

export default function RankingsPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-3 py-6 xs:px-4">
        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="font-bebas text-2xl tracking-wider">Rankings</h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
            Updated hourly
          </span>
        </div>
        <Leaderboard />
      </main>
    </>
  );
}
