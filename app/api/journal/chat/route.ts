import { NextResponse } from "next/server";
import { getAdminEmail, isAdmin, requireAuth } from "@/lib/auth";
import { listTrades, listUserTrades, rateLimit } from "@/lib/kv";
import { journalChat, type ChatMessage } from "@/lib/ai-chat";
import { isAiConfigured } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 30;
const MAX_CONTENT_CHARS = 4000;

function validateMessages(raw: unknown): ChatMessage[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "messages must be an array" };
  if (raw.length === 0) return { error: "messages cannot be empty" };
  if (raw.length > MAX_MESSAGES) return { error: "too many messages" };

  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return { error: "invalid message" };
    const rec = m as Record<string, unknown>;
    const role = rec.role;
    const content = rec.content;
    if (role !== "user" && role !== "assistant") {
      return { error: "role must be user or assistant" };
    }
    if (typeof content !== "string" || !content.trim()) {
      return { error: "content must be a non-empty string" };
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return { error: "content too long" };
    }
    out.push({ role, content: content.trim() });
  }
  // Last message must be from user.
  if (out[out.length - 1].role !== "user") {
    return { error: "last message must be from user" };
  }
  return out;
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (res) {
    return res as Response;
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "chat not configured — ANTHROPIC_API_KEY missing" },
      { status: 503 }
    );
  }

  // Rate limit: 20 calls per 10 minutes per user. Claude calls are ~cheap but
  // this prevents runaway loops or abuse if creds leak.
  const rl = await rateLimit(`chat:${session.sub}`, 20, 600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `rate limited — retry in ${rl.resetIn}s` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const msgs = validateMessages((body as Record<string, unknown>).messages);
  if ("error" in msgs) {
    return NextResponse.json({ error: msgs.error }, { status: 400 });
  }

  // Admin sees the main public journal (their trading record). Non-admin
  // users see their own private journal.
  const admin = await isAdmin();
  const trades = admin
    ? await listTrades(500)
    : await listUserTrades(session.sub, 500);

  try {
    const result = await journalChat({
      trades,
      messages: msgs,
      who: admin ? getAdminEmail() : session.sub,
    });
    return NextResponse.json({
      reply: result.reply,
      tradeCount: trades.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "chat failed";
    console.error("[journal-chat]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
