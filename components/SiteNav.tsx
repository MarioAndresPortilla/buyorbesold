import Link from "next/link";
import { headers } from "next/headers";
import { getUser } from "@/lib/auth";
import NotificationBell from "./NotificationBell";
import LogoutButton from "./LogoutButton";

interface SiteNavProps {
  /** Container max-width class. Default 1400px for wide pages. */
  maxWidth?: string;
}

interface NavLink {
  href: string;
  label: string;
  short?: string;
  hideBelow?: "xs" | "sm" | "md";
  /** Paths that should mark this link active. Defaults to [href]. */
  matches?: string[];
}

/**
 * The single canonical site navigation. Same link set on every page so
 * visitors build reliable muscle memory. Per-page link overrides are
 * deliberately removed — contextual sub-navigation uses SubNav instead.
 *
 * Behavior:
 *   - "Journal" points to /my-journal when logged in, /journal otherwise
 *   - Active page gets a gold accent + bottom bar underline
 *   - Trailing slot: "Sign up" for anonymous, Bell + Sign out for users
 *   - Sticky with blur backdrop
 */
export default async function SiteNav({
  maxWidth = "max-w-[1400px]",
}: SiteNavProps) {
  const user = await getUser().catch(() => null);
  const hdrs = await headers();
  const pathname =
    hdrs.get("x-pathname") ?? hdrs.get("x-invoke-path") ?? "";

  const links: NavLink[] = [
    { href: "/dashboard", label: "Dashboard", short: "Dash", matches: ["/dashboard"] },
    { href: "/scanner", label: "Scanner", matches: ["/scanner"] },
    user
      ? {
          href: "/my-journal",
          label: "My Journal",
          short: "Journal",
          matches: ["/my-journal", "/journal"],
        }
      : {
          href: "/journal",
          label: "Journal",
          matches: ["/journal", "/my-journal"],
        },
    { href: "/briefings", label: "Briefings", short: "Briefs", matches: ["/briefings"] },
    {
      href: "/rankings",
      label: "Rankings",
      short: "Rank",
      hideBelow: "sm",
      matches: ["/rankings", "/trader"],
    },
    {
      href: "/feed",
      label: "Feed",
      hideBelow: "md",
      matches: ["/feed"],
    },
  ];

  function isActive(link: NavLink): boolean {
    if (!pathname) return false;
    const paths = link.matches ?? [link.href];
    return paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--bg)]/92 backdrop-blur-md">
      <div
        className={`mx-auto flex items-center justify-between gap-2 px-3 py-2.5 xs:gap-3 xs:px-4 xs:py-3 ${maxWidth}`}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80 xs:gap-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)] xs:h-9 xs:w-9 xs:text-lg">
            B/S
          </span>
          <span className="truncate font-bebas text-lg tracking-wider xs:text-xl">
            BUYORBESOLD
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] uppercase tracking-[0.12em] xs:gap-1.5 xs:text-[11px] xs:tracking-[0.15em] sm:gap-2">
          {links.map((link) => {
            const hide =
              link.hideBelow === "xs"
                ? "hidden xs:inline-flex"
                : link.hideBelow === "sm"
                  ? "hidden sm:inline-flex"
                  : link.hideBelow === "md"
                    ? "hidden md:inline-flex"
                    : "inline-flex";
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${hide} relative items-center px-1.5 py-1 transition-colors xs:px-2 ${
                  active
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.short ? (
                  <>
                    <span className="xs:hidden">{link.short}</span>
                    <span className="hidden xs:inline">{link.label}</span>
                  </>
                ) : (
                  link.label
                )}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-1.5 -bottom-[11px] h-[2px] bg-[color:var(--accent)] xs:inset-x-2"
                  />
                )}
              </Link>
            );
          })}

          {/* Trailing: user menu or signup CTA */}
          <div className="ml-1 flex items-center gap-1.5 border-l border-[color:var(--border)]/60 pl-1.5 xs:ml-2 xs:gap-2 xs:pl-3">
            {user ? (
              <>
                <NotificationBell />
                <LogoutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 px-2.5 py-1 font-bold text-[color:var(--accent)] transition-colors hover:bg-[color:var(--accent)]/20"
              >
                Sign up
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
