import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { generateBrief, type BriefEdition } from "@/lib/ai-brief";
import { fetchAllMarkets } from "@/lib/markets";
import { runScanner } from "@/lib/scanner";
import { saveAiBrief } from "@/lib/kv";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_EDITIONS = new Set<BriefEdition>(["premarket", "midday", "postmarket"]);

/**
 * Admin-only manual trigger for AI brief generation.
 * POST /api/generate-brief?edition=postmarket
 *
 * Generates the brief, saves to KV, returns the result.
 * Does NOT send emails — use /api/cron/send-brief for that.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set in environment variables" },
      { status: 500 }
    );
  }

  try {
    const url = new URL(req.url);
    const edition = (url.searchParams.get("edition") ?? "postmarket") as BriefEdition;
    if (!VALID_EDITIONS.has(edition)) {
      return NextResponse.json({ error: "edition must be premarket, midday, or postmarket" }, { status: 400 });
    }

    const market = await fetchAllMarkets();
    const scanner = await runScanner().catch(() => ({
      topLongs: [],
      topShorts: [],
      scannedAt: new Date().toISOString(),
      candidateCount: 0,
      qualifiedCount: 0,
      degraded: true,
      notes: ["scanner unavailable"],
      criteria: { priceMin: 1, priceMax: 20, maxFloat: 20_000_000, minRvol: 1.5, smaBouncePct: 0.02 },
    }));

    const brief = await generateBrief(edition, market, scanner);
    const saved = await saveAiBrief(brief);

    return NextResponse.json({
      success: true,
      saved,
      brief: {
        slug: brief.slug,
        date: brief.date,
        title: brief.title,
        summary: brief.summary,
        take: brief.take.slice(0, 500) + (brief.take.length > 500 ? "..." : ""),
        tags: brief.tags,
      },
    });
  } catch (err) {
    console.error("[generate-brief] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation failed" },
      { status: 500 }
    );
  }
}
