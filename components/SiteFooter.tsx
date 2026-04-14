import Link from "next/link";

interface SiteFooterProps {
  /** Optional meta line (e.g. "Cached 5 min · Yahoo + Finnhub"). */
  sub?: string;
  /**
   * @deprecated kept for backward-compat; footer is now uniform site-wide.
   * This prop is ignored — every page gets the same footer.
   */
  minimal?: boolean;
}

/**
 * The canonical site footer. Deliberately does NOT repeat links that already
 * appear in SiteNav (Dashboard, Scanner, Journal, Briefings, Rankings, Feed).
 * Instead it surfaces only the items the header can't: Newsletter signup,
 * RSS feed, legal pages, and sign-in — plus the disclaimer.
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

        {/* Single subscribe CTA — /newsletter covers email AND RSS */}
        <div className="mb-4 flex items-center justify-center">
          <Link
            href="/newsletter"
            className="rounded-md border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent)] transition-colors hover:bg-[color:var(--accent)]/20 xs:text-[11px]"
          >
            Subscribe to the daily brief
          </Link>
        </div>

        {/* Divider */}
        <div className="mx-auto mb-4 h-px w-16 bg-[color:var(--border)]" />

        {/* Legal + account */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]/60">
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
