import Link from "next/link";
import { getUser } from "@/lib/auth";
import NotificationBell from "./NotificationBell";

interface SiteNavProps {
  maxWidth?: string;
  extra?: Array<{ href: string; label: string; short?: string; hideBelow?: "xs" | "sm" }>;
  links?: Array<{ href: string; label: string; short?: string; hideBelow?: "xs" | "sm" }>;
  trailing?: React.ReactNode;
}

export default async function SiteNav({
  maxWidth = "max-w-[1200px]",
  links,
  extra,
  trailing,
}: SiteNavProps) {
  // When using default links, check auth and inject "My Journal" for logged-in users.
  const user = links ? null : await getUser().catch(() => null);

  const defaultLinks: Array<{
    href: string;
    label: string;
    short?: string;
    hideBelow?: "xs" | "sm";
  }> = [
    { href: "/dashboard", label: "Dashboard", short: "Dash" },
    { href: "/scanner", label: "Scanner", short: "Scan" },
    ...(user
      ? [{ href: "/my-journal", label: "My Journal", short: "Mine" }]
      : [{ href: "/journal", label: "Journal", short: "J" }]),
    { href: "/rankings", label: "Rankings", hideBelow: "sm" as const },
    { href: "/feed", label: "Feed", hideBelow: "sm" as const },
    { href: "/briefings", label: "Briefs", hideBelow: "xs" as const },
  ];

  const navLinks = links ?? defaultLinks;
  const allLinks = extra ? [...navLinks, ...extra] : navLinks;

  return (
    <header className="border-b border-[color:var(--border)]">
      <div
        className={`mx-auto flex items-center justify-between gap-2 px-3 py-3 xs:gap-3 xs:px-4 xs:py-4 ${maxWidth}`}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2 xs:gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)] xs:h-9 xs:w-9 xs:text-lg">
            B/S
          </span>
          <span className="truncate font-bebas text-lg tracking-wider xs:text-xl">
            BUYORBESOLD
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)] xs:gap-3 xs:tracking-[0.12em] sm:gap-4 sm:text-[11px] sm:tracking-[0.15em]">
          {allLinks.map((link) => {
            const hide =
              link.hideBelow === "xs"
                ? "hidden xs:inline"
                : link.hideBelow === "sm"
                  ? "hidden sm:inline"
                  : "";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`hover:text-[color:var(--accent)] ${hide}`}
              >
                {link.short ? (
                  <>
                    <span className="xs:hidden">{link.short}</span>
                    <span className="hidden xs:inline">{link.label}</span>
                  </>
                ) : (
                  link.label
                )}
              </Link>
            );
          })}
          {/* Show sign-up CTA for anonymous users on default nav */}
          {!links && !user && !trailing && (
            <Link
              href="/login"
              className="rounded-md border border-[color:var(--accent)]/60 bg-[color:var(--accent)]/10 px-2 py-1 text-[color:var(--accent)] hover:bg-[color:var(--accent)]/20"
            >
              Sign up
            </Link>
          )}
          {!links && user && <NotificationBell />}
          {trailing}
        </nav>
      </div>
    </header>
  );
}
