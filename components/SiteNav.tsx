import Link from "next/link";
import { headers } from "next/headers";
import { getUser, getAdminEmail } from "@/lib/auth";
import NotificationBell from "./NotificationBell";
import LogoutButton from "./LogoutButton";
import MobileMenu from "./MobileMenu";

interface SiteNavProps {
  /** Container max-width class. Default 1400px for wide pages. */
  maxWidth?: string;
}

interface NavLink {
  href: string;
  label: string;
  short?: string;
  /** Hide below this breakpoint on desktop nav. */
  hideBelow?: "sm" | "md" | "lg";
  matches?: string[];
}

/**
 * The canonical site navigation.
 *
 * Two modes based on viewport:
 *   - Below md (<768px): compact logo + hamburger → MobileMenu drawer
 *   - md and up: horizontal nav with active-page underline
 *
 * Same link set in both. "Journal" routes to /my-journal when logged in.
 * Active page gets gold accent + underline (desktop) or gold bg (mobile).
 */
export default async function SiteNav({
  maxWidth = "max-w-[1400px]",
}: SiteNavProps) {
  const user = await getUser().catch(() => null);
  const adminEmail = getAdminEmail();
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
      hideBelow: "lg",
      matches: ["/rankings", "/trader"],
    },
    {
      href: "/feed",
      label: "Feed",
      hideBelow: "lg",
      matches: ["/feed"],
    },
    {
      href: "/congress",
      label: "Congress",
      hideBelow: "lg",
      matches: ["/congress"],
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
        className={`mx-auto flex items-center justify-between gap-3 px-3 py-2.5 xs:px-4 xs:py-3 ${maxWidth}`}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80 xs:gap-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)] xs:h-9 xs:w-9 xs:text-lg">
            B/S
          </span>
          <span className="truncate font-bebas text-base tracking-wider xs:text-lg sm:text-xl">
            BUYORBESOLD
          </span>
        </Link>

        {/* Desktop nav — hidden below md, where the hamburger takes over */}
        <nav className="hidden shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-[0.15em] md:flex lg:gap-2">
          {links.map((link) => {
            const hide =
              link.hideBelow === "sm"
                ? "hidden sm:inline-flex"
                : link.hideBelow === "md"
                  ? "hidden md:inline-flex"
                  : link.hideBelow === "lg"
                    ? "hidden lg:inline-flex"
                    : "inline-flex";
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${hide} relative items-center px-2 py-1 transition-colors ${
                  active
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-[11px] h-[2px] bg-[color:var(--accent)]"
                  />
                )}
              </Link>
            );
          })}

          {/* Desktop trailing */}
          <div className="ml-2 flex items-center gap-2 border-l border-[color:var(--border)]/60 pl-3">
            {user ? (
              <>
                <NotificationBell />
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-2 py-1 text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                >
                  Log in
                </Link>
                <Link
                  href="/login"
                  className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 px-3 py-1 font-bold text-[color:var(--accent)] transition-colors hover:bg-[color:var(--accent)]/20"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* Mobile trailing — hamburger + notification bell (if signed in) */}
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          {user && <NotificationBell />}
          <MobileMenu
            links={links.map((l) => ({
              href: l.href,
              label: l.label,
              matches: l.matches,
            }))}
            signedIn={!!user}
            adminEmail={adminEmail}
          />
        </div>
      </div>
    </header>
  );
}
