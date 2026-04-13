import { NextResponse } from "next/server";
import { getLatestBriefAsync } from "@/lib/briefs";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  const brief = await getLatestBriefAsync();
  return NextResponse.json(brief, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
    },
  });
}
