import MarketDashboard from "@/components/MarketDashboard";
import { getLatestBrief } from "@/lib/briefs";
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
    Promise.resolve(getLatestBrief()),
  ]);

  return <MarketDashboard initialData={market} brief={brief} />;
}
