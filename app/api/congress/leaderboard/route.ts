import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, type CongressRankMetric } from "@/lib/congress-queries";
import type { CongressStatPeriod } from "@/lib/congress-types";

export const revalidate = 300; // 5 min ISR

const VALID_PERIODS = new Set<CongressStatPeriod>(["1m", "3m", "ytd", "1y", "all"]);
const VALID_METRICS = new Set<CongressRankMetric>([
  "timing_alpha_30d",
  "timing_alpha_90d",
  "total_trades",
  "est_volume_usd",
  "win_rate_30d",
]);

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const period = (params.get("period") ?? "1y") as CongressStatPeriod;
  const metric = (params.get("metric") ?? "timing_alpha_30d") as CongressRankMetric;
  const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "20", 10) || 20, 1), 100);
  const qualifyingOnly = params.get("qualifying") !== "false";

  if (!VALID_PERIODS.has(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  if (!VALID_METRICS.has(metric)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  try {
    const entries = await getLeaderboard({ period, metric, limit, qualifyingOnly });
    return NextResponse.json({
      entries,
      query: { period, metric, limit, qualifyingOnly },
    });
  } catch (err) {
    console.error("[congress/leaderboard] failed:", err);
    return NextResponse.json(
      { error: "leaderboard query failed" },
      { status: 500 },
    );
  }
}
