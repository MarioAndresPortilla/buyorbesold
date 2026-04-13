import { NextResponse } from "next/server";
import { getAdminEmail, isAuthConfigured, setSessionCookie, verifyToken } from "@/lib/auth";

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

  // Redirect admin to the public journal, regular users to their own.
  const admin = getAdminEmail();
  const isAdminUser = admin && claims.sub.toLowerCase() === admin;
  const dest = isAdminUser ? "/journal?welcome=1" : "/my-journal?welcome=1";
  return NextResponse.redirect(new URL(dest, req.url));
}
