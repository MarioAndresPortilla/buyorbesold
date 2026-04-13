"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  useKeyboardShortcuts,
  type ShortcutConfig,
} from "../lib/use-keyboard-shortcuts";
import KeyboardShortcutsHelp, { ShortcutsHint } from "./KeyboardShortcutsHelp";

// ─── Context ───

interface KeyboardNavContextValue {
  /** Currently selected row index (-1 = nothing selected) */
  selectedIndex: number;
  /** Manually set the selected row */
  setSelectedIndex: (index: number) => void;
  /** Number of navigable rows */
  rowCount: number;
  /** Whether the help panel is open */
  showHelp: boolean;
  /** Toggle help panel */
  setShowHelp: (show: boolean) => void;
}

const KeyboardNavContext = createContext<KeyboardNavContextValue | null>(null);

/** Consume keyboard-nav context from any child component */
export function useKeyboardNav(): KeyboardNavContextValue {
  const ctx = useContext(KeyboardNavContext);
  if (!ctx) {
    throw new Error(
      "useKeyboardNav must be used within a <KeyboardNav> provider"
    );
  }
  return ctx;
}

// ─── Row Highlight Helper ───

/**
 * Returns class names to apply to a table row for keyboard-nav highlighting.
 * Usage: <tr className={keyboardRowClass(index, selectedIndex)}>
 */
export function keyboardRowClass(
  rowIndex: number,
  selectedIndex: number
): string {
  if (rowIndex !== selectedIndex) return "";
  return "ring-1 ring-[color:var(--accent)] bg-[color:var(--accent)]/5";
}

// ─── Provider Props ───

interface KeyboardNavProps {
  children: ReactNode;
  /** Total navigable rows */
  rowCount: number;
  /**
   * Called when user presses Enter on a selected row.
   * Receives the selected index. Return the URL to navigate to,
   * or handle navigation yourself and return void.
   */
  onEnter?: (index: number) => string | void;
  /**
   * Called when user presses f on a selected row.
   * Receives the selected index.
   */
  onFollow?: (index: number) => void;
  /**
   * Extra shortcuts to merge in (page-specific: period filters, view toggle, etc.)
   */
  extraShortcuts?: ShortcutConfig;
  /** Whether keyboard nav is enabled (default true) */
  enabled?: boolean;
}

// ─── Provider ───

export default function KeyboardNav({
  children,
  rowCount,
  onEnter,
  onFollow,
  extraShortcuts,
  enabled = true,
}: KeyboardNavProps) {
  const router = useRouter();
  const [index, setIndex] = useState(-1);
  const [helpOpen, setHelpOpen] = useState(false);

  // Refs to keep handlers from going stale inside the shortcut config
  const indexRef = useRef(index);
  indexRef.current = index;

  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  const onFollowRef = useRef(onFollow);
  onFollowRef.current = onFollow;

  const helpRef = useRef(helpOpen);
  helpRef.current = helpOpen;

  // Build the full shortcut config — uses refs so the object identity is stable
  const shortcuts = useMemo<ShortcutConfig>(() => {
    const base: ShortcutConfig = {
      // ── Row Navigation ──
      j: {
        description: "Move down one row",
        handler: () =>
          setIndex((prev) => (prev < rowCount - 1 ? prev + 1 : prev)),
      },
      k: {
        description: "Move up one row",
        handler: () => setIndex((prev) => (prev > 0 ? prev - 1 : prev)),
      },

      // ── Enter ──
      Enter: {
        description: "Open selected trader profile",
        handler: () => {
          const i = indexRef.current;
          const cb = onEnterRef.current;
          if (i < 0 || !cb) return;
          const url = cb(i);
          if (url) router.push(url);
        },
      },

      // ── Follow ──
      f: {
        description: "Follow / unfollow selected trader",
        handler: () => {
          const i = indexRef.current;
          const cb = onFollowRef.current;
          if (i < 0 || !cb) return;
          cb(i);
        },
      },

      // ── Search ──
      "/": {
        description: "Focus search input",
        handler: (e) => {
          const searchInput =
            document.querySelector<HTMLInputElement>('input[type="search"]') ??
            document.querySelector<HTMLInputElement>(
              'input[placeholder*="earch"]'
            );
          if (searchInput) {
            e.preventDefault();
            searchInput.focus();
          }
        },
      },

      // ── Escape ──
      Escape: {
        description: "Close modal / deselect row",
        handler: () => setIndex(-1),
      },

      // ── Help ──
      "?": {
        description: "Toggle keyboard shortcuts help",
        handler: () => setHelpOpen((prev) => !prev),
      },

      // ── Go-to chords ──
      "g r": {
        description: "Go to Rankings",
        handler: () => router.push("/rankings"),
      },
      "g f": {
        description: "Go to Feed",
        handler: () => router.push("/feed"),
      },
      "g d": {
        description: "Go to Dashboard",
        handler: () => router.push("/dashboard"),
      },
      "g s": {
        description: "Go to Scanner",
        handler: () => router.push("/scanner"),
      },
      "g j": {
        description: "Go to Journal",
        handler: () => router.push("/journal"),
      },
    };

    // Merge extra shortcuts (page-specific)
    if (extraShortcuts) {
      Object.assign(base, extraShortcuts);
    }

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowCount, extraShortcuts, router]);

  // Wire up the hook (single instance — no duplicates)
  useKeyboardShortcuts({ shortcuts, rowCount, enabled });

  const ctxValue = useMemo<KeyboardNavContextValue>(
    () => ({
      selectedIndex: index,
      setSelectedIndex: setIndex,
      rowCount,
      showHelp: helpOpen,
      setShowHelp: setHelpOpen,
    }),
    [index, rowCount, helpOpen]
  );

  return (
    <KeyboardNavContext.Provider value={ctxValue}>
      {children}

      {/* Help panel */}
      <KeyboardShortcutsHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      {/* Persistent hint */}
      {!helpOpen && <ShortcutsHint onClick={() => setHelpOpen(true)} />}
    </KeyboardNavContext.Provider>
  );
}
