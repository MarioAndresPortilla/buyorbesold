import { NextResponse } from "next/server";
import { getLatestBrief } from "@/lib/briefs";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  const brief = getLatestBrief();
  return NextResponse.json(brief, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
