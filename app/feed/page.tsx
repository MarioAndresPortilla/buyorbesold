import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import TradeFeed from "@/components/TradeFeed";

export const metadata: Metadata = {
  title: "Trade Feed",
  description:
    "Live trade feed from verified traders. Filter by asset class, strategy, side, and more.",
};

export default function FeedPage() {
  return (
    <>
      <SiteNav
        extra={[{ href: "/rankings", label: "Rankings" }]}
      />
      <main className="mx-auto max-w-[1200px] px-3 py-6 xs:px-4">
        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="font-bebas text-2xl tracking-wider">Trades</h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
            Live feed
          </span>
        </div>
        <TradeFeed />
      </main>
    </>
  );
}
