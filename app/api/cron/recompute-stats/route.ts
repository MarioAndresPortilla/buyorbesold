import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { computeTraderStats } from "@/lib/social-trading-stats";
import type {
  AssetClass,
  RankPeriod,
  SocialTrade,
  TradeSide,
} from "@/lib/social-trading-types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes — Pro tier

// ─────────────────────────────────────────────
// Dimension enums
// ─────────────────────────────────────────────

const PERIODS: RankPeriod[] = ["1d", "1w", "1m", "3m", "ytd", "1y", "all"];
const ASSET_CLASSES: (AssetClass | "all")[] = [
  "all",
  "stocks",
  "options",
  "crypto",
  "forex",
];
const SIDES: (TradeSide | "both")[] = ["both", "long", "short"];

// ─────────────────────────────────────────────
// Snake → camelCase mapper
// ─────────────────────────────────────────────

interface TradeRow {
  id: string;
  trader_id: string;
  symbol: string;
  instrument_name: string | null;
  asset_class: AssetClass;
  side: TradeSide;
  strategy: string;
  size: string | number;
  size_unit: string | null;
  entry_price: string | number;
  entry_date: string;
  exit_price: string | number | null;
  exit_date: string | null;
  stop_price: string | number | null;
  target_price: string | number | null;
  thesis: string | null;
  tags: string[] | null;
  verification: string;
  comment_count: number;
  reaction_count: number;
  created_at: string;
  updated_at: string;
}

function mapRowToTrade(row: TradeRow): SocialTrade {
  return {
    id: row.id,
    traderId: row.trader_id,
    symbol: row.symbol,
    instrumentName: row.instrument_name ?? undefined,
    assetClass: row.asset_class,
    side: row.side,
    strategy: row.strategy as SocialTrade["strategy"],
    size: Number(row.size),
    sizeUnit: row.size_unit ?? undefined,
    entryPrice: Number(row.entry_price),
    entryDate: row.entry_date,
    exitPrice: row.exit_price ? Number(row.exit_price) : undefined,
    exitDate: row.exit_date ?? undefined,
    stopPrice: row.stop_price ? Number(row.stop_price) : undefined,
    targetPrice: row.target_price ? Number(row.target_price) : undefined,
    thesis: row.thesis ?? undefined,
    tags: row.tags ?? [],
    verification: row.verification as SocialTrade["verification"],
    commentCount: row.comment_count,
    reactionCount: row.reaction_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────
// Cron handler
// ─────────────────────────────────────────────

export async function GET(req: Request) {
  // 1. Auth — same CRON_SECRET pattern as send-brief
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    const url = new URL(req.url);
    if (!url.searchParams.has("force")) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }
  }

  const startTime = Date.now();

  try {
    // 2. Fetch all traders
    const traders = await query<{ id: string }>`SELECT id FROM traders`;

    if (traders.length === 0) {
      console.log("[cron/recompute-stats] No traders found — nothing to do.");
      return NextResponse.json({
        ok: true,
        tradersProcessed: 0,
        statsUpserted: 0,
        durationMs: Date.now() - startTime,
      });
    }

    console.log(
      `[cron/recompute-stats] Starting recomputation for ${traders.length} trader(s).`
    );

    let totalStatsUpserted = 0;
    let tradersProcessed = 0;
    let tradersSkipped = 0;

    for (const trader of traders) {
      // 3. Fetch all trades for this trader
      const tradeRows = await query<TradeRow>`
        SELECT * FROM social_trades WHERE trader_id = ${trader.id}
      `;

      if (tradeRows.length === 0) {
        tradersSkipped++;
        continue;
      }

      const trades = tradeRows.map(mapRowToTrade);

      // Determine which asset classes this trader actually has trades in
      const traderAssetClasses = new Set(trades.map((t) => t.assetClass));
      // Always include "all", plus only the asset classes the trader has trades in
      const assetClassesToCompute: (AssetClass | "all")[] = [
        "all",
        ...ASSET_CLASSES.filter(
          (ac) => ac !== "all" && traderAssetClasses.has(ac as AssetClass)
        ),
      ];

      // 4. Compute stats for every dimension combo
      for (const period of PERIODS) {
        for (const assetClass of assetClassesToCompute) {
          for (const side of SIDES) {
            const stats = computeTraderStats(
              trader.id,
              trades,
              period,
              assetClass,
              side
            );

            // 5. Upsert into trader_stats
            await query`
              INSERT INTO trader_stats (
                trader_id, period, asset_class, side,
                total_trades, closed_trades, open_trades,
                wins, losses, breakeven,
                win_rate, win_rate_wilson,
                total_pnl_pct, avg_win_pct, avg_loss_pct,
                profit_factor, expectancy,
                avg_r_multiple, sharpe, sortino,
                max_drawdown_pct, max_losing_streak,
                avg_hold_duration_ms, avg_hold_duration_label,
                best_trade_pnl_pct, worst_trade_pnl_pct,
                best_trade_id, worst_trade_id,
                equity_curve, computed_at
              ) VALUES (
                ${stats.traderId},
                ${stats.period},
                ${stats.assetClass},
                ${stats.side},
                ${stats.totalTrades},
                ${stats.closedTrades},
                ${stats.openTrades},
                ${stats.wins},
                ${stats.losses},
                ${stats.breakeven},
                ${stats.winRate},
                ${stats.winRateWilson},
                ${stats.totalPnlPct},
                ${stats.avgWinPct},
                ${stats.avgLossPct},
                ${stats.profitFactor},
                ${stats.expectancy},
                ${stats.avgRMultiple},
                ${stats.sharpe},
                ${stats.sortino},
                ${stats.maxDrawdownPct},
                ${stats.maxLosingStreak},
                ${stats.avgHoldDurationMs},
                ${stats.avgHoldDurationLabel},
                ${stats.bestTradePnlPct},
                ${stats.worstTradePnlPct},
                ${stats.bestTradeId ?? null},
                ${stats.worstTradeId ?? null},
                ${JSON.stringify(stats.equityCurve)},
                ${stats.computedAt}
              )
              ON CONFLICT (trader_id, period, asset_class, side)
              DO UPDATE SET
                total_trades = EXCLUDED.total_trades,
                closed_trades = EXCLUDED.closed_trades,
                open_trades = EXCLUDED.open_trades,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                breakeven = EXCLUDED.breakeven,
                win_rate = EXCLUDED.win_rate,
                win_rate_wilson = EXCLUDED.win_rate_wilson,
                total_pnl_pct = EXCLUDED.total_pnl_pct,
                avg_win_pct = EXCLUDED.avg_win_pct,
                avg_loss_pct = EXCLUDED.avg_loss_pct,
                profit_factor = EXCLUDED.profit_factor,
                expectancy = EXCLUDED.expectancy,
                avg_r_multiple = EXCLUDED.avg_r_multiple,
                sharpe = EXCLUDED.sharpe,
                sortino = EXCLUDED.sortino,
                max_drawdown_pct = EXCLUDED.max_drawdown_pct,
                max_losing_streak = EXCLUDED.max_losing_streak,
                avg_hold_duration_ms = EXCLUDED.avg_hold_duration_ms,
                avg_hold_duration_label = EXCLUDED.avg_hold_duration_label,
                best_trade_pnl_pct = EXCLUDED.best_trade_pnl_pct,
                worst_trade_pnl_pct = EXCLUDED.worst_trade_pnl_pct,
                best_trade_id = EXCLUDED.best_trade_id,
                worst_trade_id = EXCLUDED.worst_trade_id,
                equity_curve = EXCLUDED.equity_curve,
                computed_at = EXCLUDED.computed_at
            `;

            totalStatsUpserted++;
          }
        }
      }

      tradersProcessed++;
      console.log(
        `[cron/recompute-stats] Trader ${trader.id}: ${tradeRows.length} trades, ` +
          `${assetClassesToCompute.length} asset classes x ${PERIODS.length} periods x ${SIDES.length} sides`
      );
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[cron/recompute-stats] Done. ${tradersProcessed} traders processed, ` +
        `${tradersSkipped} skipped (no trades), ${totalStatsUpserted} stat rows upserted ` +
        `in ${durationMs}ms.`
    );

    return NextResponse.json({
      ok: true,
      tradersProcessed,
      tradersSkipped,
      statsUpserted: totalStatsUpserted,
      durationMs,
    });
  } catch (err) {
    console.error("[cron/recompute-stats] fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "recomputation failed" },
      { status: 500 }
    );
  }
}
