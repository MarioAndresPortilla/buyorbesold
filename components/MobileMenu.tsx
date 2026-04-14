"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface NavLink {
  href: string;
  label: string;
  matches?: string[];
}

interface MobileMenuProps {
  links: NavLink[];
  signedIn: boolean;
  adminEmail?: string | null;
}

/**
 * Hamburger menu + slide-out drawer for mobile / narrow viewports.
 * Shown only below md breakpoint (SiteNav controls visibility).
 *
 * UX:
 *   - Tap hamburger → drawer slides in from right with backdrop
 *   - Tap backdrop or any link → drawer closes
 *   - ESC closes
 *   - Active route highlighted in the drawer
 *   - Body scroll locked while open
 */
export default function MobileMenu({ links, signedIn }: MobileMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isActive = useCallback(
    (link: NavLink) => {
      if (!pathname) return false;
      const paths = link.matches ?? [link.href];
      return paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
    },
    [pathname]
  );

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Backdrop — always mounted when open, solid overlay */}
      {open && (
        <div
          className="md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="fixed inset-0 z-[60] bg-black/70"
            style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          />

          {/* Drawer panel — explicit right-anchored fixed positioning so it
              never depends on flex layout or h-full fallbacks. Uses 100dvh
              with svh fallback so iOS Safari address-bar collapse doesn't
              clip the bottom. */}
          <aside
            className="fixed right-0 top-0 z-[70] flex w-[82vw] max-w-[320px] flex-col border-l border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_0_40px_rgba(0,0,0,0.45)]"
            style={{
              height: "100svh",
              minHeight: "100vh",
              animation: "slide-in 200ms ease-out",
            }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)]">
                  B/S
                </span>
                <span className="truncate font-bebas text-base tracking-wider">
                  BUYORBESOLD
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--border)]/40 hover:text-[color:var(--text)]"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Nav links — min-h-0 is required so flex-1 can shrink and
                overflow-y-auto takes effect instead of the list growing the
                parent. */}
            <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
              {links.length === 0 ? (
                <div className="px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                  No nav links
                </div>
              ) : (
                links.map((link) => {
                  const active = isActive(link);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-md px-3 py-3 font-mono text-[13px] font-medium uppercase tracking-[0.12em] transition-colors ${
                        active
                          ? "bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                          : "text-[color:var(--text)] hover:bg-[color:var(--border)]/40"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]"
                        />
                      )}
                      <span className="flex-1">{link.label}</span>
                      <span
                        aria-hidden
                        className="text-[color:var(--muted)]/50"
                      >
                        →
                      </span>
                    </Link>
                  );
                })
              )}
            </nav>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-[color:var(--border)] p-4">
              {signedIn ? (
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2,var(--surface))] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--accent)] transition-colors hover:bg-[color:var(--accent)]/20"
                >
                  Sign up free →
                </Link>
              )}
              <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)]/70">
                Not financial advice
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
