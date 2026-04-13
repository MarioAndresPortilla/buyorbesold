import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isKvAvailable, listUserTrades, saveUserTrade } from "@/lib/kv";
import { computeTradeDerived, newTradeId } from "@/lib/journal";
import type { Trade, TradeInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SIDES = new Set(["long", "short"]);
const VALID_SETUPS = new Set(["sma-bounce", "breakout", "catalyst", "reversal", "other"]);

function validateInput(body: unknown): TradeInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid body" };
  const b = body as Record<string, unknown>;

  const symbol = typeof b.symbol === "string" ? b.symbol.trim().toUpperCase() : "";
  if (!symbol || symbol.length > 16) return { error: "invalid symbol" };

  const side = String(b.side ?? "").toLowerCase();
  if (!VALID_SIDES.has(side)) return { error: "side must be long or short" };

  const setupType = String(b.setupType ?? "other").toLowerCase();
  if (!VALID_SETUPS.has(setupType)) return { error: "invalid setupType" };

  const entryDate = typeof b.entryDate === "string" ? b.entryDate : "";
  if (!entryDate || Number.isNaN(new Date(entryDate).getTime()))
    return { error: "invalid entryDate" };

  const entryPrice = Number(b.entryPrice);
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return { error: "invalid entryPrice" };

  const size = Number(b.size);
  if (!Number.isFinite(size) || size <= 0) return { error: "invalid size" };

  const thesis = typeof b.thesis === "string" ? b.thesis.trim() : "";
  if (!thesis || thesis.length > 2000) return { error: "invalid thesis" };

  const tags = Array.isArray(b.tags)
    ? b.tags.filter((t): t is string => typeof t === "string").slice(0, 10)
    : [];

  const stop = b.stop != null && b.stop !== "" ? Number(b.stop) : undefined;
  const target = b.target != null && b.target !== "" ? Number(b.target) : undefined;
  const exitDate = typeof b.exitDate === "string" && b.exitDate ? b.exitDate : undefined;
  const exitPrice = b.exitPrice != null && b.exitPrice !== "" ? Number(b.exitPrice) : undefined;

  return {
    symbol,
    side: side as "long" | "short",
    setupType: setupType as TradeInput["setupType"],
    entryDate, entryPrice, exitDate, exitPrice,
    size, stop, target, thesis, tags,
  };
}

export async function GET(req: Request) {
  let session;
  try { session = await requireAuth(); } catch (res) { return res as Response; }

  const trades = await listUserTrades(session.sub, 200);
  const withDerived = trades.map(computeTradeDerived);
  return NextResponse.json({ trades: withDerived, kvAvailable: isKvAvailable() });
}

export async function POST(req: Request) {
  let session;
  try { session = await requireAuth(); } catch (res) { return res as Response; }

  if (!isKvAvailable()) {
    return NextResponse.json(
      { error: "Storage not provisioned." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const valid = validateInput(body);
  if ("error" in valid) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const now = new Date().toISOString();
  const trade: Trade = {
    id: newTradeId(),
    ...valid,
    tags: valid.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  const ok = await saveUserTrade(session.sub, trade);
  if (!ok) return NextResponse.json({ error: "could not persist trade" }, { status: 500 });

  return NextResponse.json({ success: true, trade: computeTradeDerived(trade) }, { status: 201 });
}
