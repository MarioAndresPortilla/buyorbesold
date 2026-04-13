import Link from "next/link";

interface SiteNavProps {
  /** Max width container class. Defaults to max-w-[1200px]. */
  maxWidth?: string;
  /** Extra nav links to render after the defaults (e.g. page-specific). */
  extra?: Array<{ href: string; label: string; short?: string; hideBelow?: "xs" | "sm" }>;
  /** Override which links to show in the right nav. */
  links?: Array<{ href: string; label: string; short?: string; hideBelow?: "xs" | "sm" }>;
  /** Slot for additional right-side content (e.g. LogoutButton). */
  trailing?: React.ReactNode;
}

const DEFAULT_LINKS: Array<{
  href: string;
  label: string;
  short?: string;
  hideBelow?: "xs" | "sm";
}> = [
  { href: "/dashboard", label: "Dashboard", short: "Dash" },
  { href: "/scanner", label: "Scanner" },
  { href: "/journal", label: "Journal" },
  { href: "/briefings", label: "Briefs", hideBelow: "xs" },
];

export default function SiteNav({
  maxWidth = "max-w-[1200px]",
  links,
  extra,
  trailing,
}: SiteNavProps) {
  const navLinks = links ?? DEFAULT_LINKS;
  const allLinks = extra ? [...navLinks, ...extra] : navLinks;

  return (
    <header className="border-b border-[color:var(--border)]">
      <div
        className={`mx-auto flex items-center justify-between gap-2 px-3 py-3 xs:gap-3 xs:px-4 xs:py-4 ${maxWidth}`}
      >
        {/* Logo */}
        <Link href="/" className="flex min-w-0 items-center gap-2 xs:gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)] xs:h-9 xs:w-9 xs:text-lg">
            B/S
          </span>
          <span className="truncate font-bebas text-lg tracking-wider xs:text-xl">
            BUYORBESOLD
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex shrink-0 items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)] xs:gap-4 xs:text-[11px] xs:tracking-[0.15em]">
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
          {trailing}
        </nav>
      </div>
    </header>
  );
}
