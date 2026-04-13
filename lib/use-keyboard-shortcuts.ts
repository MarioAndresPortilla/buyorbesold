"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───

export interface ShortcutHandler {
  /** Human-readable description shown in the help panel */
  description: string;
  /** Handler function; receives the keyboard event */
  handler: (e: KeyboardEvent) => void;
}

export interface ShortcutConfig {
  [key: string]: ShortcutHandler;
}

export interface UseKeyboardShortcutsOptions {
  /** Map of key combos to handlers. Single keys: "j", "k", "/". Chords: "g r", "g f". */
  shortcuts: ShortcutConfig;
  /** Total number of navigable rows (for j/k bounds) */
  rowCount?: number;
  /** Whether shortcuts are enabled (default true) */
  enabled?: boolean;
}

export interface UseKeyboardShortcutsReturn {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

// ─── Ignored Elements ───

const IGNORED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTyping(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  if (IGNORED_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

// ─── Hook ───

export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions
): UseKeyboardShortcutsReturn {
  const { shortcuts, rowCount = 0, enabled = true } = options;

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);

  // Chord state: track pending first key and a timeout
  const chordRef = useRef<string | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest shortcuts in a ref so the keydown handler never goes stale
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const rowCountRef = useRef(rowCount);
  rowCountRef.current = rowCount;

  const clearChord = useCallback(() => {
    chordRef.current = null;
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Never intercept when user is typing in a form element
      if (isTyping(e)) {
        // Exception: Escape should still work in inputs to blur them
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // Ignore events with modifier keys (except Shift for ?)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const sc = shortcutsRef.current;
      const key = e.key;

      // ── Check for chord completion ──
      if (chordRef.current) {
        const chord = `${chordRef.current} ${key}`;
        clearChord();
        if (sc[chord]) {
          e.preventDefault();
          sc[chord].handler(e);
          return;
        }
        // Chord didn't match — fall through to single-key handling
      }

      // ── Check if this key starts a chord ──
      // Look for any shortcut that starts with "key " (e.g. "g r" starts with "g ")
      const startsChord = Object.keys(sc).some(
        (k) => k.startsWith(`${key} `) && k.split(" ").length === 2
      );

      if (startsChord) {
        chordRef.current = key;
        chordTimerRef.current = setTimeout(() => {
          chordRef.current = null;
          chordTimerRef.current = null;
        }, 500);
        // Don't prevent default yet — the key might also be a standalone shortcut
        // but chords take priority, so we wait
        return;
      }

      // ── Single-key shortcuts ──
      if (sc[key]) {
        e.preventDefault();
        sc[key].handler(e);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearChord();
    };
  }, [enabled, clearChord]);

  // Clamp selected index when row count changes
  useEffect(() => {
    if (rowCount > 0 && selectedIndex >= rowCount) {
      setSelectedIndex(rowCount - 1);
    }
  }, [rowCount, selectedIndex]);

  return { selectedIndex, setSelectedIndex, showHelp, setShowHelp };
}
