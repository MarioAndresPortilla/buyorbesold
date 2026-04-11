import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteTrade, getTrade, saveTrade } from "@/lib/kv";
import { computeTradeDerived } from "@/lib/journal";
import type { Trade } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function GET(_req: Request, { params }: RouteContext) {
  const trade = await getTrade(params.id);
  if (!trade) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ trade: computeTradeDerived(trade) });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const existing = await getTrade(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Partial<Trade>;

  // Only allow updating a known subset of fields.
  const merged: Trade = {
    ...existing,
    exitDate: body.exitDate ?? existing.exitDate,
    exitPrice:
      body.exitPrice !== undefined && body.exitPrice !== null
        ? Number(body.exitPrice)
        : existing.exitPrice,
    stop: body.stop !== undefined ? body.stop : existing.stop,
    target: body.target !== undefined ? body.target : existing.target,
    thesis:
      typeof body.thesis === "string" && body.thesis.length <= 2000
        ? body.thesis
        : existing.thesis,
    tags: Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 10)
      : existing.tags,
    updatedAt: new Date().toISOString(),
  };

  const ok = await saveTrade(merged);
  if (!ok) {
    return NextResponse.json({ error: "could not persist update" }, { status: 500 });
  }
  return NextResponse.json({ trade: computeTradeDerived(merged) });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const ok = await deleteTrade(params.id);
  if (!ok) return NextResponse.json({ error: "delete failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}
