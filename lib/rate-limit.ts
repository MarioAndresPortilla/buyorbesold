import { rateLimit } from "./kv";

/**
 * Extract client IP from Next.js request headers. Vercel sets
 * `x-forwarded-for` and `x-real-ip`. Fall back to "unknown" so the limiter
 * still buckets per-unknown (prevents one anonymous abuser from burning
 * everyone else's quota — they still share a bucket).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Common rate limit profiles used across public POST routes.
 */
export const LIMITS = {
  subscribe: { limit: 5, windowSec: 60 * 60 }, // 5 sign-ups per IP per hour
  login: { limit: 5, windowSec: 60 * 10 }, // 5 magic links per IP per 10 min
  digest: { limit: 3, windowSec: 60 * 60 * 24 }, // 3 digests per IP per day
  journalWrite: { limit: 60, windowSec: 60 }, // 60 writes per admin per min
} as const;

export async function enforceRateLimit(
  key: string,
  profile: { limit: number; windowSec: number }
): Promise<{ ok: boolean; remaining: number; resetIn: number }> {
  return rateLimit(key, profile.limit, profile.windowSec);
}
