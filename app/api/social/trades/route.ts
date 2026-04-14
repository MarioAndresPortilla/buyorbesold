import { NextResponse } from "next/server";
import { query, first, coerceNums, TRADE_NUMERIC_FIELDS } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * POST /api/social/trades — Create a new trade
 *
 * Open to any logged-in trader. The trader must have a profile in the
 * `traders` table (created via /onboarding). The trade is owned by the
 * caller — we resolve trader_id from the session email, never from the
 * request body.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  try {
    const trader = first(
      await query<{ id: string }>`SELECT id FROM traders WHERE email = ${session.sub}`
    );
    if (!trader) {
      return NextResponse.json(
        { error: "Trader profile not found. Visit /onboarding to set one up." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      symbol,
      asset_class,
      side,
      strategy,
      size,
      size_unit = "shares",
      entry_price,
      entry_date,
      exit_price,
      exit_date,
      stop_price,
      target_price,
      thesis,
      tags = [],
    } = body;

    if (!symbol || !asset_class || !side || !strategy || !size || !entry_price || !entry_date) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: symbol, asset_class, side, strategy, size, entry_price, entry_date",
        },
        { status: 400 }
      );
    }

    const rows = await query`
      INSERT INTO social_trades (
        trader_id, symbol, asset_class, side, strategy,
        size, size_unit, entry_price, entry_date,
        exit_price, exit_date, stop_price, target_price,
        thesis, tags
      ) VALUES (
        ${trader.id}, ${symbol.toUpperCase()}, ${asset_class}, ${side}, ${strategy},
        ${size}, ${size_unit}, ${entry_price}, ${entry_date},
        ${exit_price ?? null}, ${exit_date ?? null}, ${stop_price ?? null}, ${target_price ?? null},
        ${thesis ?? null}, ${tags}
      )
      RETURNING *
    `;

    return NextResponse.json(coerceNums(rows[0], TRADE_NUMERIC_FIELDS), { status: 201 });
  } catch (err) {
    console.error("[trades] Create failed:", err);
    return NextResponse.json({ error: "Failed to create trade" }, { status: 500 });
  }
}

/**
 * PATCH /api/social/trades — Update a trade (close it, adjust stop/target).
 * Only the trade owner can update it.
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, exit_price, exit_date, stop_price, target_price, thesis, tags } = body;

    if (!id) {
      return NextResponse.json({ error: "Trade id required" }, { status: 400 });
    }

    const trader = first(
      await query<{ id: string }>`SELECT id FROM traders WHERE email = ${session.sub}`
    );
    if (!trader) {
      return NextResponse.json({ error: "Trader profile not found" }, { status: 404 });
    }

    const existing = first(
      await query<{ trader_id: string }>`SELECT trader_id FROM social_trades WHERE id = ${id}`
    );
    if (!existing || existing.trader_id !== trader.id) {
      return NextResponse.json(
        { error: "Trade not found or not owned by you" },
        { status: 404 }
      );
    }

    const rows = await query`
      UPDATE social_trades SET
        exit_price = COALESCE(${exit_price ?? null}, exit_price),
        exit_date = COALESCE(${exit_date ?? null}, exit_date),
        stop_price = COALESCE(${stop_price ?? null}, stop_price),
        target_price = COALESCE(${target_price ?? null}, target_price),
        thesis = COALESCE(${thesis ?? null}, thesis),
        tags = COALESCE(${tags ?? null}, tags)
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(coerceNums(rows[0], TRADE_NUMERIC_FIELDS));
  } catch (err) {
    console.error("[trades] Update failed:", err);
    return NextResponse.json({ error: "Failed to update trade" }, { status: 500 });
  }
}
