/**
 * Thin wrapper around @vercel/kv that gracefully no-ops when KV isn't
 * provisioned. Lets features like scanner archive + digest signup ship without
 * forcing the user to set up KV on day 1.
 *
 * Env required (Vercel auto-provisions these when you create a KV store):
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
 */

import type { ScannerResult, Trade } from "./types";

export function isKvAvailable(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  );
}

// Lazy import so apps without KV installed still build cleanly.
type KvClient = typeof import("@vercel/kv")["kv"];
let _kv: KvClient | null = null;

async function getKv(): Promise<KvClient | null> {
  if (!isKvAvailable()) return null;
  if (_kv) return _kv;
  try {
    const mod = await import("@vercel/kv");
    _kv = mod.kv;
    return _kv;
  } catch (err) {
    console.warn("[kv] import fail:", err);
    return null;
  }
}

// ---- Scanner archive ----

const ARCHIVE_PREFIX = "scanner:archive:";
const ARCHIVE_INDEX = "scanner:archive:index";
const ARCHIVE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function dateKey(date = new Date()): string {
  // YYYY-MM-DD in UTC. Market close snapshots for the US session are captured
  // during the same UTC day (after 4pm ET = 8pm UTC).
  return date.toISOString().slice(0, 10);
}

/**
 * Save today's scanner result to the archive if (a) KV is available and
 * (b) we haven't already captured a snapshot for today. First-caller-of-day wins.
 *
 * Returns true if a new snapshot was written.
 */
export async function saveScannerSnapshot(result: ScannerResult): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  try {
    const key = `${ARCHIVE_PREFIX}${dateKey()}`;
    const existing = await kv.get(key);
    if (existing) return false;
    await kv.set(key, result, { ex: ARCHIVE_TTL_SECONDS });
    await kv.zadd(ARCHIVE_INDEX, {
      score: Date.now(),
      member: dateKey(),
    });
    return true;
  } catch (err) {
    console.warn("[kv] saveScannerSnapshot fail:", err);
    return false;
  }
}

/**
 * Load the last N days of scanner archive entries, newest first.
 */
export async function loadScannerArchive(
  days = 7
): Promise<Array<{ date: string; result: ScannerResult }>> {
  const kv = await getKv();
  if (!kv) return [];
  try {
    // zrange with rev returns newest-first when the index is scored by timestamp.
    const dates = await kv.zrange<string[]>(ARCHIVE_INDEX, 0, days - 1, {
      rev: true,
    });
    if (!dates || !dates.length) return [];
    const keys = dates.map((d) => `${ARCHIVE_PREFIX}${d}`);
    const results = await kv.mget<ScannerResult[]>(...keys);
    return dates
      .map((date, i) => {
        const result = results[i];
        return result ? { date, result } : null;
      })
      .filter((x): x is { date: string; result: ScannerResult } => x !== null);
  } catch (err) {
    console.warn("[kv] loadScannerArchive fail:", err);
    return [];
  }
}

// ---- Digest email (soft queue; reserved for cron when Pro tier is available) ----

const DIGEST_QUEUE = "scanner:digest:recent";
const DIGEST_TTL_SECONDS = 60 * 60 * 24 * 7; // keep history for 7 days

/**
 * Record that a user requested a digest email. Lets us rate-limit (1 per
 * 24h per email) and later batch-process via cron.
 */
export async function recordDigestRequest(email: string): Promise<{ ok: boolean; reason?: string }> {
  const kv = await getKv();
  if (!kv) {
    // No KV = no rate limiting. Caller should still send the email.
    return { ok: true };
  }
  try {
    const key = `scanner:digest:${email}`;
    const existing = await kv.get<string>(key);
    if (existing) {
      return { ok: false, reason: "already requested in the last 24 hours" };
    }
    const now = new Date().toISOString();
    await kv.set(key, now, { ex: 60 * 60 * 24 });
    await kv.zadd(DIGEST_QUEUE, { score: Date.now(), member: email });
    await kv.expire(DIGEST_QUEUE, DIGEST_TTL_SECONDS);
    return { ok: true };
  } catch (err) {
    console.warn("[kv] recordDigestRequest fail:", err);
    // Fail open — still send the email rather than block.
    return { ok: true };
  }
}

// ---- Trading journal ----

const TRADE_PREFIX = "journal:trade:";
const TRADE_INDEX = "journal:trades:index";

export async function saveTrade(trade: Trade): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  try {
    await kv.set(`${TRADE_PREFIX}${trade.id}`, trade);
    // Score = entry date ms (or createdAt) so zrange returns chronological order.
    const score = new Date(trade.entryDate).getTime() || Date.now();
    await kv.zadd(TRADE_INDEX, { score, member: trade.id });
    return true;
  } catch (err) {
    console.warn("[kv] saveTrade fail:", err);
    return false;
  }
}

export async function getTrade(id: string): Promise<Trade | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    const t = await kv.get<Trade>(`${TRADE_PREFIX}${id}`);
    return t ?? null;
  } catch (err) {
    console.warn("[kv] getTrade fail:", err);
    return null;
  }
}

export async function listTrades(limit = 100): Promise<Trade[]> {
  const kv = await getKv();
  if (!kv) return [];
  try {
    const ids = await kv.zrange<string[]>(TRADE_INDEX, 0, limit - 1, {
      rev: true,
    });
    if (!ids || !ids.length) return [];
    const trades = await kv.mget<Trade[]>(
      ...ids.map((id) => `${TRADE_PREFIX}${id}`)
    );
    return trades.filter((t): t is Trade => t !== null);
  } catch (err) {
    console.warn("[kv] listTrades fail:", err);
    return [];
  }
}

export async function deleteTrade(id: string): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  try {
    await kv.del(`${TRADE_PREFIX}${id}`);
    await kv.zrem(TRADE_INDEX, id);
    return true;
  } catch (err) {
    console.warn("[kv] deleteTrade fail:", err);
    return false;
  }
}

// ---- Newsletter subscribers (local fallback to Resend audience) ----

const SUBSCRIBERS_SET = "newsletter:subscribers";
const BRIEF_SENT_PREFIX = "newsletter:sent:";

/**
 * Add an email to the newsletter subscribers set. Idempotent.
 * Returns false if KV isn't provisioned.
 */
export async function addSubscriber(email: string): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  try {
    await kv.sadd(SUBSCRIBERS_SET, email.toLowerCase());
    return true;
  } catch (err) {
    console.warn("[kv] addSubscriber fail:", err);
    return false;
  }
}

export async function listSubscribers(): Promise<string[]> {
  const kv = await getKv();
  if (!kv) return [];
  try {
    const members = await kv.smembers(SUBSCRIBERS_SET);
    return (members ?? []).map((m) => String(m));
  } catch (err) {
    console.warn("[kv] listSubscribers fail:", err);
    return [];
  }
}

export async function removeSubscriber(email: string): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  try {
    await kv.srem(SUBSCRIBERS_SET, email.toLowerCase());
    return true;
  } catch (err) {
    console.warn("[kv] removeSubscriber fail:", err);
    return false;
  }
}

/**
 * Has this brief already been emailed? Used for cron idempotency so the
 * same brief doesn't get sent twice on a retry.
 */
export async function wasBriefSent(slug: string): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  try {
    const key = `${BRIEF_SENT_PREFIX}${slug}`;
    const existing = await kv.get(key);
    return existing !== null && existing !== undefined;
  } catch (err) {
    console.warn("[kv] wasBriefSent fail:", err);
    return false;
  }
}

export async function markBriefSent(slug: string, count: number): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  try {
    const key = `${BRIEF_SENT_PREFIX}${slug}`;
    await kv.set(
      key,
      { sentAt: new Date().toISOString(), recipients: count },
      // Keep marker for 60 days so reruns from old caches are still blocked.
      { ex: 60 * 24 * 60 * 60 }
    );
  } catch (err) {
    console.warn("[kv] markBriefSent fail:", err);
  }
}

// ---- Rate limiting (token bucket via counter + TTL) ----

/**
 * Fixed-window rate limiter. Allows up to `limit` requests per `windowSec`
 * seconds for the given key. Returns `{ ok: false }` once exceeded.
 *
 * Fails open (returns ok=true) if KV isn't available — we don't want to
 * hard-block public routes just because KV isn't provisioned yet.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; remaining: number; resetIn: number }> {
  const kv = await getKv();
  if (!kv) {
    return { ok: true, remaining: limit, resetIn: windowSec };
  }
  try {
    const fullKey = `ratelimit:${key}`;
    const count = await kv.incr(fullKey);
    if (count === 1) {
      await kv.expire(fullKey, windowSec);
    }
    if (count > limit) {
      const ttl = await kv.ttl(fullKey);
      return { ok: false, remaining: 0, resetIn: ttl > 0 ? ttl : windowSec };
    }
    return { ok: true, remaining: Math.max(0, limit - count), resetIn: windowSec };
  } catch (err) {
    console.warn("[kv] rateLimit fail:", err);
    return { ok: true, remaining: limit, resetIn: windowSec };
  }
}
