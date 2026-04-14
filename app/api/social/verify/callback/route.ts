/**
 * GET /api/social/verify/callback — OAuth callback from broker
 *
 * Handles the redirect back from Alpaca after the user authorizes.
 * Validates the state token, exchanges the code for an access token,
 * imports trades, and redirects to the settings page.
 *
 * Not financial advice. Verification is provided for transparency only.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { query, first } from "@/lib/db";
import {
  exchangeAlpacaCode,
  importAlpacaTrades,
} from "@/lib/broker-verification";

const STATE_COOKIE = "bobs-verify-state";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectBase = `${siteUrl}/settings/verification`;

  // Handle broker-side errors (user denied, etc.)
  if (error) {
    console.error("[verify/callback] Broker returned error:", error);
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Missing code or state parameter")}`
    );
  }

  // ── Validate state token (CSRF protection) ──

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Invalid state — please try again")}`
    );
  }

  // Clear the state cookie
  cookieStore.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // Verify the state JWT
  const claims = await verifyToken(state);
  if (!claims) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("State token expired — please try again")}`
    );
  }

  // The state token's `sub` field contains the JSON payload we encoded
  let statePayload: { email: string; broker: string };
  try {
    statePayload = JSON.parse(claims.sub);
  } catch {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Malformed state token")}`
    );
  }

  // ── Find the trader ──

  const trader = first(
    await query<{ id: string }>`
      SELECT id FROM traders WHERE email = ${statePayload.email}
    `
  );

  if (!trader) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Trader profile not found")}`
    );
  }

  // ── Exchange code for access token ──

  try {
    const tokenResponse = await exchangeAlpacaCode(code);

    // ── Import trades ──

    const result = await importAlpacaTrades(
      trader.id,
      tokenResponse.access_token
    );

    const accountLabel = result.accountType === "paper" ? "Alpaca Paper" : "Alpaca Live";
    const successMsg = `Connected to ${accountLabel}. Imported ${result.imported} trade${result.imported !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} already existed)` : ""}.`;

    return NextResponse.redirect(
      `${redirectBase}?success=${encodeURIComponent(successMsg)}`
    );
  } catch (err) {
    console.error("[verify/callback] Trade import failed:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error during import";
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(message)}`
    );
  }
}
