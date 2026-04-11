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

  const admin = getAdminEmail();
  if (!admin || claims.sub.toLowerCase() !== admin) {
    return NextResponse.redirect(new URL("/login?error=forbidden", req.url));
  }

  await setSessionCookie(claims.sub);
  return NextResponse.redirect(new URL("/journal?welcome=1", req.url));
}
