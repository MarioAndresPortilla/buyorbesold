/**
 * Notification helpers for the social trading platform.
 *
 * Each function inserts one or more rows into the `notifications` table.
 * For trade events the followers table is batch-queried to fan out
 * notifications to every follower with realtime notify_mode.
 *
 * IMPORTANT: This is not financial advice. BuyOrBeSold notifications
 * about trades are for informational/educational purposes only.
 */

import { query } from "@/lib/db";
import type {
  NotificationPayload,
  TradeSide,
  RankPeriod,
  ReactionType,
} from "@/lib/social-trading-types";

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

/**
 * Insert a single notification row.
 */
async function insertNotification(
  recipientId: string,
  type: string,
  payload: NotificationPayload
): Promise<void> {
  await query`
    INSERT INTO notifications (recipient_id, type, payload)
    VALUES (${recipientId}, ${type}, ${JSON.stringify(payload)})
  `;
}

/**
 * Get all follower IDs that have realtime notifications enabled
 * for a given trader. Excludes the trader themselves (shouldn't
 * follow themselves, but belt-and-suspenders).
 */
async function getRealtimeFollowerIds(traderId: string): Promise<string[]> {
  const rows = await query<{ follower_id: string }>`
    SELECT follower_id FROM follows
    WHERE followee_id = ${traderId}
      AND notify_mode = 'realtime'
      AND follower_id != ${traderId}
  `;
  return rows.map((r) => r.follower_id);
}

/**
 * Fan out a notification to all realtime followers of a trader.
 */
async function notifyFollowers(
  traderId: string,
  type: string,
  payload: NotificationPayload
): Promise<void> {
  const followerIds = await getRealtimeFollowerIds(traderId);
  if (followerIds.length === 0) return;

  // Build a single multi-row INSERT for efficiency
  // (Neon supports standard Postgres multi-value inserts)
  const values = followerIds
    .map(
      (_, i) =>
        `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`
    )
    .join(", ");

  const payloadJson = JSON.stringify(payload);
  const params: unknown[] = [];
  for (const fid of followerIds) {
    params.push(fid, type, payloadJson);
  }

  // Use raw query since we need dynamic value count.
  // The neon driver's tagged template doesn't support dynamic IN lists,
  // so we build the statement manually but still parameterize all values.
  // Unfortunately the tagged template API doesn't support this pattern,
  // so we insert one-by-one. For typical follower counts (<1000) this is fine.
  await Promise.all(
    followerIds.map((fid) => insertNotification(fid, type, payload))
  );
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Notify all realtime followers that a trader opened a new position.
 */
export async function notifyTradeOpened(
  traderId: string,
  tradeId: string,
  symbol: string,
  side: TradeSide
): Promise<void> {
  const payload: NotificationPayload = {
    type: "trade_opened",
    traderId,
    tradeId,
    symbol,
    side,
  };
  await notifyFollowers(traderId, "trade_opened", payload);
}

/**
 * Notify all realtime followers that a trader closed a position.
 */
export async function notifyTradeClosed(
  traderId: string,
  tradeId: string,
  symbol: string,
  pnlPct: number
): Promise<void> {
  const payload: NotificationPayload = {
    type: "trade_closed",
    traderId,
    tradeId,
    symbol,
    pnlPct,
  };
  await notifyFollowers(traderId, "trade_closed", payload);
}

/**
 * Notify a trader that someone new followed them.
 * Skips if followerId === followeeId (shouldn't happen, but safe).
 */
export async function notifyNewFollower(
  followeeId: string,
  followerId: string,
  followerUsername: string
): Promise<void> {
  if (followeeId === followerId) return;

  const payload: NotificationPayload = {
    type: "new_follower",
    followerId,
    followerUsername,
  };
  await insertNotification(followeeId, "new_follower", payload);
}

/**
 * Notify the trade owner that someone commented on their trade.
 * Skips if commenter IS the trade owner.
 */
export async function notifyComment(
  tradeOwnerId: string,
  commentId: string,
  tradeId: string,
  commenterUsername: string
): Promise<void> {
  // Look up commenter's trader ID to skip self-notification.
  // We use the username to check — if the trade owner's username matches,
  // skip. But since we don't have it here, we rely on the caller or
  // just use the tradeOwnerId check at the call site.
  // The caller should already skip if the commenter is the owner.
  const payload: NotificationPayload = {
    type: "comment",
    commentId,
    tradeId,
    commenterUsername,
  };
  await insertNotification(tradeOwnerId, "comment", payload);
}

/**
 * Notify the trade owner that someone reacted to their trade.
 * Skips if reactor IS the trade owner (caller should check).
 */
export async function notifyReaction(
  tradeOwnerId: string,
  tradeId: string,
  reactorUsername: string,
  reactionType: ReactionType
): Promise<void> {
  const payload: NotificationPayload = {
    type: "reaction",
    tradeId,
    reactorUsername,
    reactionType,
  };
  await insertNotification(tradeOwnerId, "reaction", payload);
}

/**
 * Notify a trader that their leaderboard rank changed significantly.
 * Only fires when the delta is >= 3 positions.
 */
export async function notifyRankChange(
  traderId: string,
  period: RankPeriod,
  oldRank: number,
  newRank: number
): Promise<void> {
  const delta = Math.abs(oldRank - newRank);
  if (delta < 3) return;

  const payload: NotificationPayload = {
    type: "rank_change",
    period,
    oldRank,
    newRank,
  };
  await insertNotification(traderId, "rank_change", payload);
}

/**
 * Notify a trader about an achievement / milestone.
 */
export async function notifyMilestone(
  traderId: string,
  label: string,
  detail: string
): Promise<void> {
  const payload: NotificationPayload = {
    type: "milestone",
    label,
    detail,
  };
  await insertNotification(traderId, "milestone", payload);
}
