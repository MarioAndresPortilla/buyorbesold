import { NextResponse } from "next/server";
import { getMemberProfile } from "@/lib/congress-queries";

export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!safe) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  try {
    const profile = await getMemberProfile(safe);
    if (!profile) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (err) {
    console.error("[congress/members/:slug] failed:", err);
    return NextResponse.json({ error: "profile query failed" }, { status: 500 });
  }
}
