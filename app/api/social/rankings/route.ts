import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { RankPeriod, RankSortKey, AssetClass, TradeSide } from "@/lib/social-trading-types";
import { RANK_MIN_TRADES } from "@/lib/social-trading-types";

export const revalidate = 300; // 5 min ISR

const VALID_PERIODS = new Set(["1d", "1w", "1m", "3m", "ytd", "1y", "all"]);
const VALID_SORTS = new Set(["sharpe", "profit_factor", "total_pnl_pct", "win_rate", "expectancy", "avg_r_multiple"]);
const VALID_ASSETS = new Set(["stocks", "options", "crypto", "forex", "all"]);
const VALID_SIDES = new Set(["long", "short", "both"]);

/**
 * GET /api/social/rankings
 *
 * Query params:
 *   period       — 1d|1w|1m|3m|ytd|1y|all (default: 1m)
 *   asset_class  — stocks|options|crypto|forex|all (default: all)
 *   side         — long|short|both (default: both)
 *   sort_by      — sharpe|profit_factor|total_pnl_pct|win_rate|expectancy|avg_r_multiple (default: sharpe)
 *   verified     — true|false (default: true)
 *   limit        — 1-100 (default: 50)
 *   offset       — 0+ (default: 0)
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const period = (params.get("period") ?? "1m") as RankPeriod;
  const assetClass = (params.get("asset_class") ?? "all") as AssetClass | "all";
  const side = (params.get("side") ?? "both") as TradeSide | "both";
  const sortBy = (params.get("sort_by") ?? "sharpe") as RankSortKey;
  const verifiedOnly = params.get("verified") !== "false";
  const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "50", 10) || 50, 1), 100);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  // Validate
  if (!VALID_PERIODS.has(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  if (!VALID_SORTS.has(sortBy)) {
    return NextResponse.json({ error: "Invalid sort_by" }, { status: 400 });
  }
  if (!VALID_ASSETS.has(assetClass)) {
    return NextResponse.json({ error: "Invalid asset_class" }, { status: 400 });
  }
  if (!VALID_SIDES.has(side)) {
    return NextResponse.json({ error: "Invalid side" }, { status: 400 });
  }

  const minTrades = RANK_MIN_TRADES[period];

  // Map sort_by to the actual column
  const sortColumn = sortBy === "win_rate" ? "win_rate_wilson" : sortBy;

  try {
    const rows = await query`
      SELECT
        t.id AS trader_id,
        t.username,
        t.display_name,
        t.avatar_url,
        t.verification,
        s.period,
        s.asset_class,
        s.side,
        s.closed_trades,
        s.win_rate,
        s.win_rate_wilson,
        s.total_pnl_pct,
        s.profit_factor,
        s.sharpe,
        s.sortino,
        s.max_drawdown_pct,
        s.avg_r_multiple,
        s.expectancy,
        s.equity_curve,
        s.avg_hold_duration_label,
        s.best_trade_pnl_pct,
        s.worst_trade_pnl_pct,
        s.computed_at
      FROM trader_stats s
      JOIN traders t ON t.id = s.trader_id
      WHERE s.period = ${period}
        AND s.asset_class = ${assetClass}
        AND s.side = ${side}
        AND s.closed_trades >= ${minTrades}
        AND t.profile_public = true
        AND (${!verifiedOnly} OR t.verification != 'self-reported')
      ORDER BY
        CASE ${sortColumn}
          WHEN 'sharpe' THEN s.sharpe
          WHEN 'profit_factor' THEN s.profit_factor
          WHEN 'total_pnl_pct' THEN s.total_pnl_pct
          WHEN 'win_rate_wilson' THEN s.win_rate_wilson
          WHEN 'expectancy' THEN s.expectancy
          WHEN 'avg_r_multiple' THEN s.avg_r_multiple
        END DESC NULLS LAST
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Attach rank numbers
    const rankings = rows.map((row, i) => ({
      rank: offset + i + 1,
      ...row,
    }));

    return NextResponse.json({
      rankings,
      query: { period, assetClass, side, sortBy, verifiedOnly, limit, offset },
      minTrades,
    });
  } catch (err) {
    console.error("[rankings] Query failed:", err);
    return NextResponse.json({ error: "Failed to load rankings" }, { status: 500 });
  }
}
