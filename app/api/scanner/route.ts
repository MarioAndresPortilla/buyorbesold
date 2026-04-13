import { NextResponse } from "next/server";
import { runScanner, parseCriteria } from "@/lib/scanner";
import { saveScannerSnapshot } from "@/lib/kv";

export const runtime = "nodejs";
export const revalidate = 300;
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    // Accept custom criteria via query params:
    // /api/scanner?priceMin=2&priceMax=10&maxFloat=10000000&minRvol=2&smaBouncePct=0.03
    const url = new URL(req.url);
    const hasCustom = ["priceMin", "priceMax", "maxFloat", "minRvol", "smaBouncePct"].some(
      (k) => url.searchParams.has(k)
    );
    const overrides = hasCustom
      ? parseCriteria(Object.fromEntries(url.searchParams))
      : undefined;

    const result = await runScanner(overrides);

    // Only snapshot to archive when using default criteria (not custom scans).
    if (!hasCustom) {
      saveScannerSnapshot(result).catch((err) =>
        console.warn("[/api/scanner] snapshot warn:", err)
      );
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": hasCustom
          ? "public, s-maxage=60, stale-while-revalidate=30"
          : "public, s-maxage=300, stale-while-revalidate=60",
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
