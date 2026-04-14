import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  CONGRESS_WATCH_SYMBOLS,
  fetchCongressTradesForSymbol,
  isFinnhubConfigured,
  type NormalizedCongressTrade,
} from "@/lib/congress-finnhub";
import { slugifyMemberName } from "@/lib/congress-types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — Vercel Pro

/**
 * Nightly Congress trade sync.
 *
 * Iterates the curated symbol watchlist, pulls disclosures from Finnhub,
 * and upserts member + trade rows. Dedupe is enforced by a unique index
 * on (member_id, symbol, transaction_date, transaction_type, amount_low).
 *
 * Runs on the Vercel cron at /api/cron/sync-congress.
 */
export async function GET(req: Request) {
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
        { status: 500 },
      );
    }
  }

  if (!isFinnhubConfigured()) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY not set" },
      { status: 503 },
    );
  }

  const startTime = Date.now();
  const symbols = CONGRESS_WATCH_SYMBOLS;

  let symbolsProcessed = 0;
  let symbolsFailed = 0;
  let tradesInserted = 0;
  let membersCreated = 0;
  const memberTouchMap = new Map<string, Set<string>>(); // memberId -> set of seen symbols (for total_trades recompute)

  try {
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      let trades: NormalizedCongressTrade[] = [];
      try {
        trades = await fetchCongressTradesForSymbol(symbol);
        symbolsProcessed++;
      } catch (err) {
        symbolsFailed++;
        console.warn(`[sync-congress] ${symbol} fetch failed:`, err);
        // Back off harder on rate-limit errors
        if (err instanceof Error && err.message.includes("rate limited")) {
          await sleep(2000);
        }
        continue;
      }

      for (const t of trades) {
        const memberId = slugifyMemberName(t.rawName);

        // Upsert member (first-seen creates it)
        const upsert = await query<{ inserted: boolean }>`
          INSERT INTO congress_members (id, raw_name, display_name)
          VALUES (${memberId}, ${t.rawName}, ${prettifyName(t.rawName)})
          ON CONFLICT (id) DO UPDATE
            SET raw_name = EXCLUDED.raw_name,
                display_name = CASE
                  WHEN congress_members.display_name = '' OR congress_members.display_name IS NULL
                    THEN EXCLUDED.display_name
                  ELSE congress_members.display_name
                END
          RETURNING (xmax = 0) AS inserted
        `;
        if (upsert[0]?.inserted) membersCreated++;

        // Insert trade (dedupe by unique index)
        const insert = await query<{ id: string }>`
          INSERT INTO congress_trades (
            member_id, symbol, asset_name, transaction_type,
            transaction_date, filing_date,
            amount_low, amount_high,
            owner_type, position, source
          ) VALUES (
            ${memberId},
            ${t.symbol},
            ${t.assetName ?? null},
            ${t.transactionType},
            ${t.transactionDate}::date,
            ${t.filingDate ?? null},
            ${t.amountLow ?? null},
            ${t.amountHigh ?? null},
            ${t.ownerType ?? null},
            ${t.position ?? null},
            'finnhub'
          )
          ON CONFLICT (member_id, symbol, transaction_date, transaction_type, COALESCE(amount_low, 0))
          DO NOTHING
          RETURNING id
        `;
        if (insert.length > 0) {
          tradesInserted++;
          const set = memberTouchMap.get(memberId) ?? new Set<string>();
          set.add(t.symbol);
          memberTouchMap.set(memberId, set);
        }
      }

      // Small delay every 10 symbols to stay well under 30/sec
      if ((i + 1) % 10 === 0) await sleep(350);
    }

    // Recompute denormalized counters on touched members
    for (const memberId of memberTouchMap.keys()) {
      await query`
        UPDATE congress_members SET
          total_trades = (
            SELECT COUNT(*) FROM congress_trades WHERE member_id = ${memberId}
          ),
          last_traded_at = (
            SELECT MAX(transaction_date)::timestamptz
            FROM congress_trades WHERE member_id = ${memberId}
          )
        WHERE id = ${memberId}
      `;
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[sync-congress] Done. ${symbolsProcessed}/${symbols.length} symbols, ` +
        `${symbolsFailed} failed, ${tradesInserted} new trades, ` +
        `${membersCreated} new members in ${durationMs}ms.`,
    );

    return NextResponse.json({
      ok: true,
      symbolsProcessed,
      symbolsFailed,
      tradesInserted,
      membersCreated,
      membersTouched: memberTouchMap.size,
      durationMs,
    });
  } catch (err) {
    console.error("[sync-congress] fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 },
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Convert "PELOSI, NANCY" or "Pelosi, Nancy" into "Nancy Pelosi" for display.
 * Idempotent — "Nancy Pelosi" passes through unchanged.
 */
function prettifyName(raw: string): string {
  const cleaned = raw.trim().replace(/^(hon\.?|rep\.?|sen\.?|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, "");
  let parts: string[];
  if (cleaned.includes(",")) {
    const [last, rest] = cleaned.split(",", 2);
    parts = [...rest.trim().split(/\s+/), last.trim()];
  } else {
    parts = cleaned.split(/\s+/);
  }
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}
