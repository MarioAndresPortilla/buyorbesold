import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  clearSessionCookie();
  return NextResponse.redirect(new URL("/journal", req.url), { status: 303 });
}
