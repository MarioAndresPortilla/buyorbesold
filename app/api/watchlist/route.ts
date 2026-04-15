import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  addToUserWatchlist,
  countUserWatchlist,
  listUserWatchlist,
  MAX_WATCHLIST_SYMBOLS,
  removeFromUserWatchlist,
} from "@/lib/user-watchlist";
import { enrichSymbols, validateSymbol } from "@/lib/watchlist";
import type { WatchlistEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let session;
  try {
    session = await requireAuth();
  } catch (res) {
    return res as Response;
  }

  const symbols = await listUserWatchlist(session.sub);
  const entries: WatchlistEntry[] = symbols.length
    ? await enrichSymbols(symbols.map((symbol) => ({ symbol })))
    : [];

  return NextResponse.json({
    entries,
    max: MAX_WATCHLIST_SYMBOLS,
  });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (res) {
    return res as Response;
  }

  const body = await req.json().catch(() => null);
  const raw = body && typeof body === "object" ? (body as { symbol?: unknown }).symbol : null;
  if (typeof raw !== "string" || !raw.trim()) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const count = await countUserWatchlist(session.sub);
  if (count >= MAX_WATCHLIST_SYMBOLS) {
    return NextResponse.json(
      { error: `Watchlist is full (max ${MAX_WATCHLIST_SYMBOLS}).` },
      { status: 400 }
    );
  }

  const resolved = await validateSymbol(raw);
  if (!resolved) {
    return NextResponse.json(
      { error: "Symbol not found on Yahoo Finance." },
      { status: 400 }
    );
  }

  const existing = await listUserWatchlist(session.sub);
  if (existing.includes(resolved.symbol)) {
    return NextResponse.json(
      { error: `${resolved.symbol} is already on your watchlist.` },
      { status: 400 }
    );
  }

  await addToUserWatchlist(session.sub, resolved.symbol);

  const symbols = await listUserWatchlist(session.sub);
  const entries = await enrichSymbols(symbols.map((symbol) => ({ symbol })));
  return NextResponse.json(
    { entries, max: MAX_WATCHLIST_SYMBOLS },
    { status: 201 }
  );
}

export async function DELETE(req: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (res) {
    return res as Response;
  }

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  await removeFromUserWatchlist(session.sub, symbol);

  const symbols = await listUserWatchlist(session.sub);
  const entries = symbols.length
    ? await enrichSymbols(symbols.map((s) => ({ symbol: s })))
    : [];
  return NextResponse.json({ entries, max: MAX_WATCHLIST_SYMBOLS });
}
