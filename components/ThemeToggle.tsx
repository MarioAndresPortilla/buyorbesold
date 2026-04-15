"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const THEME_KEY = "bobs-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "dark";
    const t = document.body.dataset.theme;
    return t === "light" || t === "dark" ? (t as Theme) : "dark";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-md border border-[color:var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] xs:px-2.5 xs:text-[10px] xs:tracking-[0.15em]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? "☀" : "☾"}
      <span className="ml-1 hidden xs:inline">
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
