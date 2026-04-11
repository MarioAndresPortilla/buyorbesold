import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { SessionClaims } from "./types";

/**
 * Magic-link + cookie auth for the trading journal.
 *
 * Design:
 *   - Only ADMIN_EMAIL can request a magic link.
 *   - Magic link contains a short-lived (15 min) JWT signed with AUTH_SECRET.
 *   - On /auth/callback, we verify the token and issue a longer session cookie
 *     (30 days) with the same JWT shape.
 *   - All journal write routes call requireAdmin() which 401s if the cookie
 *     is missing, malformed, expired, or doesn't match ADMIN_EMAIL.
 *   - Public reads need no auth.
 *
 * Graceful fallback: if AUTH_SECRET isn't set, isAuthConfigured() returns false
 * and the UI shows a "Auth not configured — add AUTH_SECRET and ADMIN_EMAIL" notice.
 * The journal still reads/renders in public mode.
 */

const SESSION_COOKIE = "bobs-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAGIC_LINK_TTL_SECONDS = 60 * 15; // 15 minutes

export function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.ADMIN_EMAIL);
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET not set");
  }
  return new TextEncoder().encode(secret);
}

export function getAdminEmail(): string | undefined {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase();
}

export async function signToken(
  email: string,
  ttlSeconds: number = SESSION_TTL_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ sub: email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      iat: Number(payload.iat ?? 0),
      exp: Number(payload.exp ?? 0),
    };
  } catch {
    return null;
  }
}

export async function signMagicLinkToken(email: string): Promise<string> {
  return signToken(email, MAGIC_LINK_TTL_SECONDS);
}

export async function setSessionCookie(email: string): Promise<void> {
  const token = await signToken(email);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionClaims | null> {
  if (!isAuthConfigured()) return null;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const admin = getAdminEmail();
  return Boolean(admin && session.sub.toLowerCase() === admin);
}

/**
 * Throws a Response (to be caught by the route handler) if the caller isn't
 * the admin. Use inside API routes.
 */
export async function requireAdmin(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "not authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const admin = getAdminEmail();
  if (!admin || session.sub.toLowerCase() !== admin) {
    throw new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return session;
}
