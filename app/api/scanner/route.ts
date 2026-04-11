import { NextResponse } from "next/server";
import { runScanner } from "@/lib/scanner";
import { saveScannerSnapshot } from "@/lib/kv";

export const runtime = "nodejs";
// Scanner is expensive (30+ external calls per run) — cache for 5 minutes.
export const revalidate = 300;
// Max allowed duration on Vercel Hobby is 10s for standard serverless;
// scanner typically finishes in 4-6s. Give it room.
export const maxDuration = 30;

export async function GET() {
  try {
    const result = await runScanner();
    // Opportunistic archive: first caller of each UTC day captures a snapshot
    // in KV (no-op if KV isn't provisioned). Fire-and-forget — never blocks
    // the response.
    saveScannerSnapshot(result).catch((err) =>
      console.warn("[/api/scanner] snapshot warn:", err)
    );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/scanner] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "scanner failed" },
      { status: 500 }
    );
  }
}
