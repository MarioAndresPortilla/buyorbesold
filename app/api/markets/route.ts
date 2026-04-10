import { NextResponse } from "next/server";
import { fetchAllMarkets } from "@/lib/markets";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    const data = await fetchAllMarkets();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    console.error("[/api/markets] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
