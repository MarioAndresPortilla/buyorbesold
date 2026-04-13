"use client";

import { useCallback, useEffect, useRef } from "react";

// ─── Types ───

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

// ─── Shortcut Groups ───

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["j"], description: "Move down one row" },
      { keys: ["k"], description: "Move up one row" },
      { keys: ["Enter"], description: "Open selected trader profile" },
      { keys: ["/"], description: "Focus search input" },
      { keys: ["Esc"], description: "Close modal / deselect row" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["f"], description: "Follow / unfollow selected trader" },
      { keys: ["v"], description: "Toggle table / card view" },
      { keys: ["?"], description: "Toggle this help panel" },
    ],
  },
  {
    title: "Go to",
    shortcuts: [
      { keys: ["g", "r"], description: "Rankings" },
      { keys: ["g", "f"], description: "Feed" },
      { keys: ["g", "d"], description: "Dashboard" },
      { keys: ["g", "s"], description: "Scanner" },
      { keys: ["g", "j"], description: "Journal" },
    ],
  },
  {
    title: "Filters",
    shortcuts: [
      { keys: ["1"], description: "1D period" },
      { keys: ["2"], description: "1W period" },
      { keys: ["3"], description: "1M period" },
      { keys: ["4"], description: "3M period" },
      { keys: ["5"], description: "YTD period" },
      { keys: ["6"], description: "1Y period" },
      { keys: ["7"], description: "All time" },
    ],
  },
];

// ─── Key Badge ───

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center rounded bg-[color:var(--surface)] border border-[color:var(--border)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--text)] min-w-[22px] text-center"
    >
      {label}
    </kbd>
  );
}

// ─── Help Panel ───

export default function KeyboardShortcutsHelp({
  open,
  onClose,
}: KeyboardShortcutsHelpProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey, { capture: true });
    return () => window.removeEventListener("keydown", handleKey, { capture: true });
  }, [open, onClose]);

  // Close on click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg mx-4 rounded-xl bg-[color:var(--bg)] border border-[color:var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
          <h2 className="font-bebas text-xl tracking-wide text-[color:var(--text)]">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors text-lg leading-none"
            aria-label="Close shortcuts help"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="font-mono text-xs uppercase tracking-widest text-[color:var(--muted)] mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc) => (
                  <div
                    key={sc.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-[color:var(--text)]">
                      {sc.description}
                    </span>
                    <span className="flex items-center gap-1 ml-4 shrink-0">
                      {sc.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-[color:var(--muted)] text-[10px]">
                              then
                            </span>
                          )}
                          <KeyBadge label={k} />
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[color:var(--border)] text-center">
          <span className="text-xs text-[color:var(--muted)]">
            Press <KeyBadge label="?" /> to toggle this panel
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Persistent Hint (bottom-right corner) ───

export function ShortcutsHint({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:var(--surface)] border border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-all opacity-60 hover:opacity-100 shadow-lg text-xs font-mono"
      aria-label="Show keyboard shortcuts"
    >
      <KeyBadge label="?" />
      <span>Shortcuts</span>
    </button>
  );
}
