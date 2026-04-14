import Link from "next/link";

interface SiteFooterProps {
  /** Optional meta line (e.g. "Cached 5 min · Yahoo + Finnhub"). */
  sub?: string;
  /**
   * @deprecated kept for backward-compat; footer is now uniform site-wide.
   * This prop is ignored — every page gets the same full footer.
   */
  minimal?: boolean;
}

/**
 * The single canonical site footer — rendered identically on every page.
 * No more "minimal" variant. Every visitor gets the same trust markers:
 * logo, full nav, legal links, disclaimer.
 */
export default function SiteFooter({ sub }: SiteFooterProps) {
  return (
    <footer className="mt-12 border-t border-[color:var(--border)] pt-8 pb-10">
      <div className="mx-auto max-w-[800px] px-4">
        {/* Logo / brand */}
        <div className="mb-5 flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 font-bebas text-xs tracking-wider text-[color:var(--accent)]">
            B/S
          </span>
          <span className="font-bebas text-base tracking-wider text-[color:var(--muted)]">
            BUYORBESOLD
          </span>
        </div>

        {/* Primary nav */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)] xs:gap-x-5 xs:text-[11px]">
          <Link href="/dashboard" className="transition-colors hover:text-[color:var(--accent)]">
            Dashboard
          </Link>
          <Link href="/scanner" className="transition-colors hover:text-[color:var(--accent)]">
            Scanner
          </Link>
          <Link href="/journal" className="transition-colors hover:text-[color:var(--accent)]">
            Journal
          </Link>
          <Link href="/briefings" className="transition-colors hover:text-[color:var(--accent)]">
            Briefings
          </Link>
          <Link href="/rankings" className="transition-colors hover:text-[color:var(--accent)]">
            Rankings
          </Link>
          <Link href="/newsletter" className="transition-colors hover:text-[color:var(--accent)]">
            Newsletter
          </Link>
          <a href="/rss.xml" className="transition-colors hover:text-[color:var(--accent)]">
            RSS
          </a>
        </div>

        {/* Divider */}
        <div className="mx-auto mb-4 h-px w-16 bg-[color:var(--border)]" />

        {/* Legal links */}
        <div className="mb-3 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]/60">
          <Link href="/legal/privacy" className="transition-colors hover:text-[color:var(--accent)]">
            Privacy
          </Link>
          <Link href="/legal/terms" className="transition-colors hover:text-[color:var(--accent)]">
            Terms
          </Link>
          <Link href="/login" className="transition-colors hover:text-[color:var(--accent)]">
            Sign in
          </Link>
        </div>

        {/* Optional meta line */}
        {sub && (
          <p className="mb-2 text-center font-mono text-[10px] leading-relaxed text-[color:var(--muted)]/50">
            {sub}
          </p>
        )}

        {/* Disclaimer + copyright */}
        <p className="text-center font-mono text-[10px] leading-relaxed text-[color:var(--muted)]/50">
          Not financial advice. Do your own research. ©{" "}
          {new Date().getFullYear()} BuyOrBeSold.com
        </p>
      </div>
    </footer>
  );
}
