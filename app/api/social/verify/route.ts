/**
 * GET  /api/social/verify?broker=alpaca — Initiate broker OAuth (redirect)
 * POST /api/social/verify               — Submit manual screenshot proof
 *
 * Not financial advice. Verification is provided for transparency only.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth, signToken, verifyToken } from "@/lib/auth";
import { query, first } from "@/lib/db";
import {
  getAlpacaAuthUrl,
  submitScreenshotProof,
} from "@/lib/broker-verification";

const STATE_COOKIE = "bobs-verify-state";
const STATE_TTL_SECONDS = 60 * 10; // 10 minutes

/**
 * GET — Initiate broker OAuth flow.
 * Generates a signed state token, stores it in a cookie, and redirects
 * the user to the broker's authorization page.
 */
export async function GET(req: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (res) {
    return res as Response;
  }

  const { searchParams } = new URL(req.url);
  const broker = searchParams.get("broker");

  if (broker !== "alpaca") {
    return NextResponse.json(
      { error: "Unsupported broker. Supported: alpaca" },
      { status: 400 }
    );
  }

  try {
    // Create a signed state token that encodes the user's email and broker
    const statePayload = JSON.stringify({
      email: session.sub,
      broker,
      ts: Date.now(),
    });
    const stateToken = await signToken(statePayload, STATE_TTL_SECONDS);

    // Store state in a cookie for CSRF validation on callback
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, stateToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_TTL_SECONDS,
    });

    const authUrl = getAlpacaAuthUrl(stateToken);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[verify] OAuth initiation failed:", err);
    return NextResponse.json(
      { error: "Failed to initiate broker connection" },
      { status: 500 }
    );
  }
}

/**
 * POST — Submit manual screenshot proof for a trade.
 * Body: { trade_id: string, image_url: string }
 */
export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (res) {
    return res as Response;
  }

  try {
    const body = await req.json();
    const { trade_id, image_url } = body;

    if (!trade_id || !image_url) {
      return NextResponse.json(
        { error: "Missing required fields: trade_id, image_url" },
        { status: 400 }
      );
    }

    // Validate image_url is a reasonable URL
    try {
      new URL(image_url);
    } catch {
      return NextResponse.json(
        { error: "image_url must be a valid URL" },
        { status: 400 }
      );
    }

    // Look up the trader by session email
    const trader = first(
      await query<{ id: string }>`SELECT id FROM traders WHERE email = ${session.sub}`
    );
    if (!trader) {
      return NextResponse.json(
        { error: "Trader profile not found" },
        { status: 404 }
      );
    }

    const updated = await submitScreenshotProof(
      trader.id,
      trade_id,
      image_url
    );

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Trade not found, not owned by you, or already has higher verification",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Trade marked as screenshot-verified",
    });
  } catch (err) {
    console.error("[verify] Screenshot submission failed:", err);
    return NextResponse.json(
      { error: "Failed to submit screenshot proof" },
      { status: 500 }
    );
  }
}
