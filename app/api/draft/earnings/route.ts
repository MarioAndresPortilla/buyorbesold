import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  draftEarningsReaction,
  isAiConfigured,
  type EarningsDraftInput,
} from "@/lib/ai";

/**
 * POST /api/draft/earnings
 *
 * Admin-only endpoint that takes structured earnings inputs and returns a
 * Claude-drafted markdown brief for Mario to paste into a new file under
 * `content/briefings/_drafts/` (then move up to `content/briefings/` once
 * edited). No production writes — the response is copy-paste only.
 *
 * Request body (JSON):
 *   {
 *     "ticker": "NVDA",            // required
 *     "quarter": "Q1 FY26",        // required
 *     "reportedOn": "2026-04-11",  // optional YYYY-MM-DD
 *     "epsActual": 2.45,           // optional
 *     "epsEst": 2.30,              // optional
 *     "revActual": 22100000000,    // optional, in dollars
 *     "revEst": 21800000000,       // optional
 *     "guidance": "...",           // optional freeform
 *     "tapeReaction": "...",       // optional freeform
 *     "keyLevels": [145, 158],     // optional
 *     "marioNotes": "...",         // optional freeform
 *     "highQuality": false         // optional — use Opus instead of Sonnet
 *   }
 *
 * Response (200): { markdown, warnings, confidence }
 * Errors:
 *   401 — not authenticated (missing/expired session cookie)
 *   403 — authenticated but not the admin
 *   400 — missing required fields or malformed JSON
 *   500 — Anthropic API not configured or draft call failed
 */
export async function POST(request: Request) {
  // requireAdmin throws a Response on failure — catch and return as-is.
  try {
    await requireAdmin();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error: "ai_not_configured",
        message:
          "ANTHROPIC_API_KEY is not set. Add it to your environment and redeploy.",
      },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const parsed = parseEarningsInput(body);
  if ("error" in parsed) {
    return NextResponse.json(parsed, { status: 400 });
  }

  const highQuality =
    typeof (body as { highQuality?: unknown }).highQuality === "boolean"
      ? (body as { highQuality: boolean }).highQuality
      : false;

  try {
    const result = await draftEarningsReaction(parsed, { highQuality });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/draft/earnings] draft fail:", err);
    return NextResponse.json(
      {
        error: "draft_failed",
        message: err instanceof Error ? err.message : "Unknown draft error",
      },
      { status: 500 }
    );
  }
}

/**
 * Validate and normalize the request body into an EarningsDraftInput.
 * Returns an error object (instead of throwing) so the route handler can
 * respond with a clean 400.
 */
function parseEarningsInput(
  body: unknown
): EarningsDraftInput | { error: string; message: string } {
  if (!body || typeof body !== "object") {
    return { error: "bad_request", message: "Body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  const ticker =
    typeof b.ticker === "string" ? b.ticker.trim().toUpperCase() : "";
  const quarter = typeof b.quarter === "string" ? b.quarter.trim() : "";
  if (!ticker) {
    return { error: "missing_ticker", message: "`ticker` is required" };
  }
  if (!quarter) {
    return { error: "missing_quarter", message: "`quarter` is required" };
  }

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

  const keyLevelsRaw = Array.isArray(b.keyLevels) ? b.keyLevels : undefined;
  const keyLevels = keyLevelsRaw
    ?.filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  return {
    ticker,
    quarter,
    reportedOn: str(b.reportedOn),
    epsActual: num(b.epsActual),
    epsEst: num(b.epsEst),
    revActual: num(b.revActual),
    revEst: num(b.revEst),
    guidance: str(b.guidance),
    tapeReaction: str(b.tapeReaction),
    keyLevels: keyLevels && keyLevels.length > 0 ? keyLevels : undefined,
    marioNotes: str(b.marioNotes),
  };
}
