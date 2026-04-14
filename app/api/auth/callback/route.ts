import { NextResponse } from "next/server";
import { getAdminEmail, isAuthConfigured, setSessionCookie, verifyToken } from "@/lib/auth";
import { getTraderByEmail } from "@/lib/traders";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=notconfigured", req.url)
    );
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing", req.url));
  }

  const claims = await verifyToken(token);
  if (!claims) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url));
  }

  // Multi-user: any verified email gets a session. Admin status is checked
  // separately via isAdmin() when writing to the PUBLIC journal.
  await setSessionCookie(claims.sub);

  const admin = getAdminEmail();
  const isAdminUser = admin && claims.sub.toLowerCase() === admin;

  // Admin still goes to the public journal (that's the legacy flow).
  if (isAdminUser) {
    return NextResponse.redirect(new URL("/journal?welcome=1", req.url));
  }

  // Regular users: check if they have a trader profile yet.
  // If not, send them to onboarding to pick a username.
  // If yes, send them straight to their profile.
  // Fails gracefully if DB isn't provisioned — falls back to /my-journal.
  try {
    const trader = await getTraderByEmail(claims.sub);
    if (!trader) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    return NextResponse.redirect(
      new URL(`/trader/${trader.username}?welcome=1`, req.url)
    );
  } catch (err) {
    console.warn("[auth/callback] trader lookup failed:", err);
    return NextResponse.redirect(new URL("/my-journal?welcome=1", req.url));
  }
}
