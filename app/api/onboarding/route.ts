import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  createTrader,
  getTraderByEmail,
  isUsernameAvailable,
  validateUsernameFormat,
} from "@/lib/traders";

export const runtime = "nodejs";

/**
 * GET /api/onboarding?check=username
 * Returns { available: boolean, reason?: string } for live username checks.
 */
export async function GET(req: Request) {
  const email = await getUser();
  if (!email) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const check = url.searchParams.get("check");
  if (check !== "username") {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  const username = (url.searchParams.get("username") ?? "").trim();
  if (!username) {
    return NextResponse.json({ available: false, reason: "too-short" });
  }

  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return NextResponse.json({ available: false, reason: formatError });
  }

  const result = await isUsernameAvailable(username);
  return NextResponse.json(
    result.ok ? { available: true } : { available: false, reason: result.reason }
  );
}

/**
 * POST /api/onboarding
 * Body: { username, displayName }
 *
 * Creates the Trader row for the authenticated email. Rejects if this
 * user already has a profile (use PATCH to update instead).
 */
export async function POST(req: Request) {
  const email = await getUser();
  if (!email) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      displayName?: string;
    };

    const username = (body.username ?? "").trim();
    const displayName = (body.displayName ?? "").trim();

    if (!username || !displayName) {
      return NextResponse.json(
        { error: "username and displayName required" },
        { status: 400 }
      );
    }

    if (displayName.length > 50) {
      return NextResponse.json(
        { error: "displayName must be 50 characters or fewer" },
        { status: 400 }
      );
    }

    // Already has a profile?
    const existing = await getTraderByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "profile already exists", username: existing.username },
        { status: 409 }
      );
    }

    // Username availability (format + uniqueness)
    const availability = await isUsernameAvailable(username);
    if (!availability.ok) {
      return NextResponse.json(
        { error: "username unavailable", reason: availability.reason },
        { status: 400 }
      );
    }

    const trader = await createTrader({ email, username, displayName });
    return NextResponse.json({ success: true, trader }, { status: 201 });
  } catch (err) {
    console.error("[onboarding] failed:", err);
    return NextResponse.json(
      { error: "failed to create profile" },
      { status: 500 }
    );
  }
}
