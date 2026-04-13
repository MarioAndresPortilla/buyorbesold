import { NextRequest, NextResponse } from "next/server";
import { sql, first } from "@/lib/db";

export const revalidate = 300;

/**
 * GET /api/social/traders?username=mario
 *
 * Fetch a trader's public profile + stats + recent trades.
 */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "username param required" }, { status: 400 });
  }

  try {
    // Trader profile
    const trader = first(
      await sql`
        SELECT id, username, display_name, avatar_url, bio,
               verification, broker_source, follower_count, following_count,
               profile_public, show_pnl_dollars, created_at
        FROM traders WHERE username = ${username.toLowerCase()}
      `
    );

    if (!trader || !(trader as any).profile_public) {
      return NextResponse.json({ error: "Trader not found" }, { status: 404 });
    }

    const traderId = (trader as any).id;

    // Stats (all-time, all assets, both sides)
    const stats = first(
      await sql`
        SELECT * FROM trader_stats
        WHERE trader_id = ${traderId}
          AND period = 'all' AND asset_class = 'all' AND side = 'both'
      `
    );

    // Recent closed trades (last 20)
    const recentTrades = await sql`
      SELECT id, symbol, instrument_name, asset_class, side, strategy,
             entry_price, entry_date, exit_price, exit_date,
             stop_price, target_price, thesis, tags,
             status, pnl_pct, hold_duration_s,
             comment_count, reaction_count, created_at
      FROM social_trades
      WHERE trader_id = ${traderId} AND status = 'closed'
      ORDER BY exit_date DESC
      LIMIT 20
    `;

    // Open positions
    const openPositions = await sql`
      SELECT id, symbol, instrument_name, asset_class, side, strategy,
             entry_price, entry_date, stop_price, target_price, thesis, tags,
             status, created_at
      FROM social_trades
      WHERE trader_id = ${traderId} AND status = 'open'
      ORDER BY entry_date DESC
    `;

    // Stats breakdown by asset class
    const statsByAsset = await sql`
      SELECT * FROM trader_stats
      WHERE trader_id = ${traderId}
        AND period = 'all' AND side = 'both'
        AND asset_class != 'all'
    `;

    return NextResponse.json({
      trader,
      stats,
      recentTrades,
      openPositions,
      statsByAsset,
    });
  } catch (err) {
    console.error("[traders] Profile fetch failed:", err);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
