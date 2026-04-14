import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { computeMemberStats, upsertMemberStats } from "@/lib/congress-stats";
import type { CongressStatPeriod } from "@/lib/congress-types";

export const runtime = "nodejs";
export const maxDuration = 300;

const PERIODS: CongressStatPeriod[] = ["1m", "3m", "ytd", "1y", "all"];

/**
 * Nightly Congress stats cron.
 *
 * Runs AFTER /api/cron/sync-congress. For every member, computes
 * stats for each period dimension and upserts into congress_member_stats.
 *
 * Forward returns are computed lazily via the price cache — first run
 * is slow (backfills Yahoo), subsequent runs are fast (cache hits).
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

  const startTime = Date.now();

  try {
    const members = await query<{ id: string }>`
      SELECT id FROM congress_members
      WHERE total_trades > 0
    `;

    if (members.length === 0) {
      return NextResponse.json({
        ok: true,
        membersProcessed: 0,
        statsUpserted: 0,
        durationMs: Date.now() - startTime,
      });
    }

    let membersProcessed = 0;
    let statsUpserted = 0;

    for (const m of members) {
      for (const period of PERIODS) {
        const stats = await computeMemberStats(m.id, period);
        await upsertMemberStats(stats);
        statsUpserted++;
      }
      membersProcessed++;
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[recompute-congress-stats] ${membersProcessed} members, ${statsUpserted} rows, ${durationMs}ms`,
    );

    return NextResponse.json({
      ok: true,
      membersProcessed,
      statsUpserted,
      durationMs,
    });
  } catch (err) {
    console.error("[recompute-congress-stats] fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "stats failed" },
      { status: 500 },
    );
  }
}
