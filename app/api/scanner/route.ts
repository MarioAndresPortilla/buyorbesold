import { NextResponse } from "next/server";
import { runScanner } from "@/lib/scanner";

export const runtime = "nodejs";
// Scanner is expensive (30+ external calls per run) — cache for 5 minutes.
export const revalidate = 300;
// Max allowed duration on Vercel Hobby is 10s for standard serverless;
// scanner typically finishes in 4-6s. Give it room.
export const maxDuration = 30;

export async function GET() {
  try {
    const result = await runScanner();
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
