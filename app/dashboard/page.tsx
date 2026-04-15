import MarketDashboard from "@/components/MarketDashboard";
import SiteNav from "@/components/SiteNav";
import { getLatestBriefAsync } from "@/lib/briefs";
import { fetchAllMarkets } from "@/lib/markets";

export const revalidate = 60;
export const metadata = {
  title: "Live Dashboard — BuyOrBeSold",
  description:
    "Live market dashboard: S&P 500, Bitcoin, gold, silver, commodities, macro, Fear & Greed. Personal takes, not financial advice.",
};

export default async function DashboardPage() {
  const [market, brief] = await Promise.all([
    fetchAllMarkets(),
    getLatestBriefAsync(),
  ]);

  return (
    <>
      <SiteNav />
      <MarketDashboard initialData={market} brief={brief} />
    </>
  );
}
