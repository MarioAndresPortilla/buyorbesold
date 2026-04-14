import { NextRequest, NextResponse } from "next/server";
import { queryCongressTrades } from "@/lib/congress-queries";
import type { CongressTradeType } from "@/lib/congress-types";

export const revalidate = 120;

const VALID_TYPES = new Set<CongressTradeType>(["buy", "sell", "exchange", "other"]);

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const memberId = params.get("member") ?? undefined;
  const symbol = params.get("symbol")?.toUpperCase() ?? undefined;
  const typeParam = params.get("type") as CongressTradeType | null;
  const transactionType = typeParam && VALID_TYPES.has(typeParam) ? typeParam : undefined;
  const since = params.get("since") ?? undefined;
  const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "100", 10) || 100, 1), 500);

  try {
    const trades = await queryCongressTrades({ memberId, symbol, transactionType, since, limit });
    return NextResponse.json({ trades, count: trades.length });
  } catch (err) {
    console.error("[congress/trades] failed:", err);
    return NextResponse.json({ error: "trades query failed" }, { status: 500 });
  }
}
