import Link from "next/link";
import React from "react";

interface Crumb {
  href?: string;
  label: string;
}

interface BreadcrumbsProps {
  items: Crumb[];
  /** Container max-width class to match parent section. */
  maxWidth?: string;
}

/**
 * Simple path breadcrumbs for deep pages (e.g. brief detail).
 * Items without `href` render as plain text (the current page).
 *
 * Example:
 *   <Breadcrumbs items={[
 *     { href: "/", label: "Home" },
 *     { href: "/briefings", label: "Briefings" },
 *     { label: "Bullion still has room" },
 *   ]} />
 */
export default function Breadcrumbs({
  items,
  maxWidth = "max-w-[1400px]",
}: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`mx-auto flex items-center gap-1.5 px-3 pt-3 pb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)] xs:px-4 xs:text-[11px] ${maxWidth}`}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="truncate transition-colors hover:text-[color:var(--accent)]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`truncate ${
                  isLast ? "text-[color:var(--text)]" : ""
                }`}
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <span aria-hidden className="shrink-0 text-[color:var(--muted)]/50">
                ›
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
