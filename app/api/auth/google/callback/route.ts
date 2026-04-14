import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { setSessionCookie, getAdminEmail } from "@/lib/auth";
import { getTraderByEmail } from "@/lib/traders";

export const runtime = "nodejs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const STATE_COOKIE = "bobs-google-oauth-state";

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

function getSiteUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function fail(req: Request, code: string) {
  const res = NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return fail(req, "notconfigured");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return fail(req, "google_cancelled");
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!stateCookie || stateCookie !== state) {
    return fail(req, "google_state");
  }

  const redirectUri = `${getSiteUrl(req)}/api/auth/google/callback`;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("[auth/google] token exchange failed:", await tokenRes.text());
    return fail(req, "google_failed");
  }

  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  const idToken = tokenJson.id_token;
  if (!idToken) {
    return fail(req, "google_failed");
  }

  let email: string | undefined;
  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
    });
    if (payload.email_verified !== true) {
      return fail(req, "google_unverified");
    }
    email = typeof payload.email === "string" ? payload.email.toLowerCase() : undefined;
  } catch (err) {
    console.error("[auth/google] id token verify failed:", err);
    return fail(req, "google_failed");
  }

  if (!email) {
    return fail(req, "google_failed");
  }

  await setSessionCookie(email);

  const admin = getAdminEmail();
  const isAdminUser = admin && email === admin;

  const postLogin = isAdminUser
    ? new URL("/journal?welcome=1", req.url)
    : await (async () => {
        try {
          const trader = await getTraderByEmail(email!);
          if (!trader) return new URL("/onboarding", req.url);
          return new URL(`/trader/${trader.username}?welcome=1`, req.url);
        } catch (err) {
          console.warn("[auth/google] trader lookup failed:", err);
          return new URL("/my-journal?welcome=1", req.url);
        }
      })();

  const res = NextResponse.redirect(postLogin);
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
