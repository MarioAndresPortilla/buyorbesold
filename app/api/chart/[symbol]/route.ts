import { NextResponse } from "next/server";
import { fetchChart, parseRange } from "@/lib/chart";

export const revalidate = 60;

interface RouteCtx {
  params: Promise<{ symbol: string }>;
}

export async function GET(req: Request, { params }: RouteCtx) {
  const { symbol: raw } = await params;
  const symbol = raw.trim().toUpperCase();
  if (!symbol || symbol.length > 16 || !/^[A-Z0-9.\-^]+$/.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range"));

  const data = await fetchChart(symbol, range);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
