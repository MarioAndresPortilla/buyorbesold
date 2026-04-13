import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const revalidate = 60; // 1 min ISR

/**
 * GET /api/social/feed
 *
 * Public trade feed with rich filtering.
 *
 * Query params:
 *   trader_id, asset_class, strategy, side, status, outcome,
 *   symbol, min_pnl_pct, max_pnl_pct, verified, sort, limit, offset
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const traderId = p.get("trader_id");
  const assetClass = p.get("asset_class");
  const strategy = p.get("strategy");
  const side = p.get("side");
  const status = p.get("status");
  const outcome = p.get("outcome");
  const symbol = p.get("symbol")?.toUpperCase() ?? null;
  const minPnl = p.get("min_pnl_pct") ? parseFloat(p.get("min_pnl_pct")!) : null;
  const maxPnl = p.get("max_pnl_pct") ? parseFloat(p.get("max_pnl_pct")!) : null;
  const verifiedOnly = p.get("verified") === "true";
  const sort = p.get("sort") ?? "newest";
  const limit = Math.min(Math.max(parseInt(p.get("limit") ?? "30", 10) || 30, 1), 100);
  const offset = Math.max(parseInt(p.get("offset") ?? "0", 10) || 0, 0);

  try {
    const rows = await query`
      SELECT
        st.id,
        st.trader_id,
        t.username,
        t.display_name,
        t.avatar_url,
        t.verification AS trader_verification,
        st.symbol,
        st.instrument_name,
        st.asset_class,
        st.side,
        st.strategy,
        st.size,
        st.size_unit,
        st.entry_price,
        st.entry_date,
        st.exit_price,
        st.exit_date,
        st.stop_price,
        st.target_price,
        st.thesis,
        st.tags,
        st.verification,
        st.status,
        st.pnl_pct,
        st.hold_duration_s,
        st.comment_count,
        st.reaction_count,
        st.created_at
      FROM social_trades st
      JOIN traders t ON t.id = st.trader_id
      WHERE t.profile_public = true
        AND (${traderId}::text IS NULL OR st.trader_id = ${traderId})
        AND (${assetClass}::text IS NULL OR st.asset_class = ${assetClass})
        AND (${strategy}::text IS NULL OR st.strategy = ${strategy})
        AND (${side}::text IS NULL OR st.side = ${side})
        AND (${status}::text IS NULL OR st.status = ${status})
        AND (${symbol}::text IS NULL OR st.symbol = ${symbol})
        AND (${minPnl}::numeric IS NULL OR st.pnl_pct >= ${minPnl})
        AND (${maxPnl}::numeric IS NULL OR st.pnl_pct <= ${maxPnl})
        AND (${!verifiedOnly} OR st.verification != 'self-reported')
        AND (
          ${outcome}::text IS NULL
          OR (${outcome} = 'win' AND st.pnl_pct > 0)
          OR (${outcome} = 'loss' AND st.pnl_pct < 0)
          OR (${outcome} = 'breakeven' AND st.pnl_pct = 0)
        )
      ORDER BY
        CASE ${sort}
          WHEN 'newest'        THEN EXTRACT(EPOCH FROM st.created_at) * -1
          WHEN 'oldest'        THEN EXTRACT(EPOCH FROM st.created_at)
          WHEN 'biggest_win'   THEN st.pnl_pct * -1
          WHEN 'biggest_loss'  THEN st.pnl_pct
          WHEN 'most_discussed' THEN (st.comment_count + st.reaction_count) * -1
          ELSE EXTRACT(EPOCH FROM st.created_at) * -1
        END
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return NextResponse.json({
      trades: rows,
      hasMore: rows.length === limit,
    });
  } catch (err) {
    console.error("[feed] Query failed:", err);
    return NextResponse.json({ error: "Failed to load feed" }, { status: 500 });
  }
}
