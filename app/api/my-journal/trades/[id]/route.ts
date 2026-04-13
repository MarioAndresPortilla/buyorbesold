import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deleteUserTrade, getUserTrade, saveUserTrade } from "@/lib/kv";
import { computeTradeDerived } from "@/lib/journal";
import type { Trade } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteContext) {
  let session;
  try { session = await requireAuth(); } catch (res) { return res as Response; }
  const { id } = await params;
  const trade = await getUserTrade(session.sub, id);
  if (!trade) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ trade: computeTradeDerived(trade) });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  let session;
  try { session = await requireAuth(); } catch (res) { return res as Response; }
  const { id } = await params;
  const existing = await getUserTrade(session.sub, id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Partial<Trade>;
  const merged: Trade = {
    ...existing,
    exitDate: body.exitDate ?? existing.exitDate,
    exitPrice: body.exitPrice != null ? Number(body.exitPrice) : existing.exitPrice,
    stop: body.stop !== undefined ? body.stop : existing.stop,
    target: body.target !== undefined ? body.target : existing.target,
    thesis: typeof body.thesis === "string" && body.thesis.length <= 2000 ? body.thesis : existing.thesis,
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 10) : existing.tags,
    updatedAt: new Date().toISOString(),
  };

  const ok = await saveUserTrade(session.sub, merged);
  if (!ok) return NextResponse.json({ error: "could not persist" }, { status: 500 });
  return NextResponse.json({ trade: computeTradeDerived(merged) });
}

export async function DELETE(req: Request, { params }: RouteContext) {
  let session;
  try { session = await requireAuth(); } catch (res) { return res as Response; }
  const { id } = await params;
  const ok = await deleteUserTrade(session.sub, id);
  if (!ok) return NextResponse.json({ error: "delete failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}
