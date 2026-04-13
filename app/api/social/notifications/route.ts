import { NextResponse } from "next/server";
import { query, first } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { Notification } from "@/lib/social-trading-types";

/**
 * GET /api/social/notifications — List notifications for the current user.
 *
 * Query params:
 *   unread_only — "true" to show only unread (default: false)
 *   limit       — max results (default: 30, max: 100)
 *   offset      — pagination offset (default: 0)
 *
 * Returns: { notifications: Notification[], unread_count: number }
 */
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const trader = first(
      await query<{ id: string }>`SELECT id FROM traders WHERE email = ${session.sub}`
    );
    if (!trader) {
      return NextResponse.json({ error: "Trader profile not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread_only") === "true";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "30", 10) || 30, 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

    // Fetch notifications
    const notifications = unreadOnly
      ? await query<Notification>`
          SELECT id, recipient_id AS "recipientId", type, payload, read, created_at AS "createdAt"
          FROM notifications
          WHERE recipient_id = ${trader.id} AND read = false
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await query<Notification>`
          SELECT id, recipient_id AS "recipientId", type, payload, read, created_at AS "createdAt"
          FROM notifications
          WHERE recipient_id = ${trader.id}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    // Unread count (always returned for the badge)
    const countRow = first(
      await query<{ count: string }>`
        SELECT count(*)::text AS count FROM notifications
        WHERE recipient_id = ${trader.id} AND read = false
      `
    );
    const unreadCount = parseInt(countRow?.count ?? "0", 10);

    return NextResponse.json({ notifications, unread_count: unreadCount });
  } catch (err) {
    console.error("[notifications/GET] Failed:", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

/**
 * PATCH /api/social/notifications — Mark notifications as read.
 *
 * Body:
 *   { ids: string[] }  — mark specific notifications as read
 *   { all: true }      — mark ALL of the user's notifications as read
 *
 * Only affects notifications owned by the authenticated user.
 */
export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const trader = first(
      await query<{ id: string }>`SELECT id FROM traders WHERE email = ${session.sub}`
    );
    if (!trader) {
      return NextResponse.json({ error: "Trader profile not found" }, { status: 404 });
    }

    const body = await req.json();

    if (body.all === true) {
      // Mark all unread notifications as read
      await query`
        UPDATE notifications SET read = true
        WHERE recipient_id = ${trader.id} AND read = false
      `;
      return NextResponse.json({ marked: "all" });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      // Mark specific IDs as read — only if they belong to this user
      // Process in parallel for efficiency
      await Promise.all(
        body.ids.map((id: string) =>
          query`
            UPDATE notifications SET read = true
            WHERE id = ${id} AND recipient_id = ${trader.id}
          `
        )
      );
      return NextResponse.json({ marked: body.ids.length });
    }

    return NextResponse.json(
      { error: "Provide { ids: string[] } or { all: true }" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[notifications/PATCH] Failed:", err);
    return NextResponse.json({ error: "Failed to mark notifications" }, { status: 500 });
  }
}
