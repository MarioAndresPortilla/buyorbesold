"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────
// Types (subset of social-trading-types, kept local to avoid server imports)
// ─────────────────────────────────────────────

interface NotificationItem {
  id: string;
  recipientId: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatNotification(n: NotificationItem): { icon: string; text: string } {
  const p = n.payload;
  switch (n.type) {
    case "trade_opened": {
      const side = (p.side as string)?.toUpperCase() ?? "LONG";
      return { icon: "\u25B2", text: `@${resolveUsername(p)} opened ${side} ${p.symbol}` };
    }
    case "trade_closed": {
      const pnl = typeof p.pnlPct === "number" ? (p.pnlPct >= 0 ? "+" : "") + Number(p.pnlPct).toFixed(1) + "%" : "";
      return { icon: "\u25BC", text: `@${resolveUsername(p)} closed ${p.symbol} ${pnl}` };
    }
    case "new_follower":
      return { icon: "\u002B", text: `@${p.followerUsername} started following you` };
    case "comment":
      return { icon: "\u2709", text: `@${p.commenterUsername} commented on your ${p.tradeId ? "trade" : "trade"}` };
    case "reaction": {
      const emoji = reactionIcon(p.reactionType as string);
      return { icon: emoji, text: `@${p.reactorUsername} reacted to your trade` };
    }
    case "rank_change":
      return { icon: "\u2191", text: `You moved from #${p.oldRank} to #${p.newRank} (${p.period})` };
    case "milestone":
      return { icon: "\u2605", text: String(p.label) };
    default:
      return { icon: "\u2022", text: "New notification" };
  }
}

/** Resolve a username from a trade notification payload. */
function resolveUsername(payload: Record<string, unknown>): string {
  // Trade notifications store traderId — we'd need a join to get the username.
  // For now, show the traderId prefix. In a future iteration, the payload
  // should include the username. We truncate for display.
  const id = (payload.traderId as string) ?? "trader";
  return id.length > 12 ? id.slice(0, 8) + "\u2026" : id;
}

function reactionIcon(type: string): string {
  switch (type) {
    case "fire": return "\uD83D\uDD25";
    case "eyes": return "\uD83D\uDC40";
    case "skull": return "\uD83D\uDC80";
    case "100": return "\uD83D\uDCAF";
    case "chart": return "\uD83D\uDCC8";
    default: return "\u2764";
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const POLL_INTERVAL = 30_000; // 30 seconds

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/social/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const markAllRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/social/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (ids: string[]) => {
    try {
      await fetch("/api/social/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - ids.length));
    } catch {
      // ignore
    }
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {/* Bell SVG */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 13a2 2 0 0 0 4 0" />
          <path d="M12.5 10.5c-.7-.7-1.5-1.2-1.5-4.5a3 3 0 0 0-6 0c0 3.3-.8 3.8-1.5 4.5h9Z" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--accent)] px-1 font-mono text-[9px] font-bold leading-none text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="fixed inset-x-3 top-14 z-50 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] shadow-lg xs:absolute xs:inset-x-auto xs:right-0 xs:top-10 xs:w-[320px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[color:var(--border)] px-3 py-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--accent)] hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center font-mono text-[11px] text-[color:var(--muted)]">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const { icon, text } = formatNotification(n);
                const pnlClass =
                  n.type === "trade_closed" && typeof n.payload.pnlPct === "number"
                    ? n.payload.pnlPct >= 0
                      ? "text-[color:var(--up)]"
                      : "text-[color:var(--down)]"
                    : "";

                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead([n.id]);
                    }}
                    className={`flex w-full items-start gap-2 border-b border-[color:var(--border)] px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--surface)] ${
                      !n.read ? "bg-[color:var(--surface)]/40" : ""
                    }`}
                  >
                    {/* Unread dot */}
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                      {!n.read ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                      ) : (
                        <span className="font-mono text-[10px] text-[color:var(--muted)]">
                          {icon}
                        </span>
                      )}
                    </span>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-mono text-[11px] leading-snug text-[color:var(--text)] ${pnlClass}`}
                      >
                        {text}
                      </p>
                      <span className="font-mono text-[10px] text-[color:var(--muted)]">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer disclaimer */}
          <div className="border-t border-[color:var(--border)] px-3 py-1.5">
            <p className="font-mono text-[9px] text-[color:var(--muted)]/60">
              Not financial advice. Trade notifications are for informational purposes only.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
