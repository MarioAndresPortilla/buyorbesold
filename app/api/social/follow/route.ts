import { NextResponse } from "next/server";
import { query, first } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * POST /api/social/follow — Follow a trader
 * Body: { followee_id, notify_mode? }
 *
 * Open to any logged-in trader with a profile.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  try {
    const { followee_id, notify_mode = "realtime" } = await req.json();

    if (!followee_id) {
      return NextResponse.json({ error: "followee_id required" }, { status: 400 });
    }

    const trader = first(
      await query<{ id: string }>`SELECT id FROM traders WHERE email = ${session.sub}`
    );
    if (!trader) {
      return NextResponse.json(
        { error: "Trader profile not found. Visit /onboarding to set one up." },
        { status: 404 }
      );
    }

    if (trader.id === followee_id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    await query`
      INSERT INTO follows (follower_id, followee_id, notify_mode)
      VALUES (${trader.id}, ${followee_id}, ${notify_mode})
      ON CONFLICT (follower_id, followee_id)
      DO UPDATE SET notify_mode = ${notify_mode}
    `;

    return NextResponse.json({ followed: true, followee_id, notify_mode });
  } catch (err) {
    console.error("[follow] Failed:", err);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }
}

/**
 * DELETE /api/social/follow — Unfollow a trader
 * Body: { followee_id }
 */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  try {
    const { followee_id } = await req.json();

    if (!followee_id) {
      return NextResponse.json({ error: "followee_id required" }, { status: 400 });
    }

    const trader = first(
      await query<{ id: string }>`SELECT id FROM traders WHERE email = ${session.sub}`
    );
    if (!trader) {
      return NextResponse.json({ error: "Trader profile not found" }, { status: 404 });
    }

    await query`
      DELETE FROM follows
      WHERE follower_id = ${trader.id} AND followee_id = ${followee_id}
    `;

    return NextResponse.json({ followed: false, followee_id });
  } catch (err) {
    console.error("[unfollow] Failed:", err);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }
}
