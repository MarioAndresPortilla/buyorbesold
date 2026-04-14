import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE = "bobs-google-oauth-state";
const STATE_TTL_SECONDS = 60 * 10;

function getSiteUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=notconfigured", req.url));
  }

  const state = crypto.randomBytes(32).toString("hex");
  const redirectUri = `${getSiteUrl(req)}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const res = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
