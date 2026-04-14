import Link from "next/link";
import { headers } from "next/headers";

interface SubNavItem {
  href: string;
  label: string;
  /** Paths that mark this item active. Default [href]. */
  matches?: string[];
}

interface SubNavProps {
  /** The section name rendered on the left (e.g. "Journal"). */
  section?: string;
  items: SubNavItem[];
  /** Container max-width class to match the parent section. */
  maxWidth?: string;
}

/**
 * Section-contextual horizontal nav that sits directly below SiteNav.
 * Use on pages that have sub-pages (e.g. /journal/*, /scanner/*).
 *
 * Example:
 *   <SubNav
 *     section="Journal"
 *     items={[
 *       { href: "/my-journal", label: "Overview" },
 *       { href: "/my-journal/new", label: "Log Trade" },
 *       { href: "/my-journal/analytics", label: "Analytics" },
 *     ]}
 *   />
 */
export default async function SubNav({
  section,
  items,
  maxWidth = "max-w-[1400px]",
}: SubNavProps) {
  const hdrs = await headers();
  const pathname =
    hdrs.get("x-pathname") ?? hdrs.get("x-invoke-path") ?? "";

  function isActive(item: SubNavItem): boolean {
    if (!pathname) return false;
    const paths = item.matches ?? [item.href];
    // Match exact path OR deeper subpath. But only mark the deepest
    // matching item as active when multiple items could match.
    return paths.some((p) => pathname === p);
  }

  // If no item matches exactly, fall back to the deepest prefix match.
  const exactMatch = items.findIndex(isActive);
  let activeIndex = exactMatch;
  if (activeIndex === -1) {
    let longest = 0;
    items.forEach((item, i) => {
      const paths = item.matches ?? [item.href];
      for (const p of paths) {
        if (pathname.startsWith(p) && p.length > longest) {
          longest = p.length;
          activeIndex = i;
        }
      }
    });
  }

  return (
    <div className="border-b border-[color:var(--border)]/60 bg-[color:var(--bg)]/60">
      <div
        className={`mx-auto flex items-center gap-3 overflow-x-auto px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] xs:px-4 xs:text-[11px] ${maxWidth}`}
      >
        {section && (
          <span className="shrink-0 font-semibold text-[color:var(--accent)]">
            {section}
          </span>
        )}
        {section && (
          <span aria-hidden className="shrink-0 text-[color:var(--muted)]/50">
            ·
          </span>
        )}
        <nav className="flex shrink-0 items-center gap-0.5 xs:gap-1.5">
          {items.map((item, i) => {
            const active = i === activeIndex;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2 py-1 transition-colors xs:px-3 ${
                  active
                    ? "bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                    : "text-[color:var(--muted)] hover:bg-[color:var(--border)]/40 hover:text-[color:var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
