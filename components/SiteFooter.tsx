import Link from "next/link";

interface SiteFooterProps {
  /** Extra context text below the nav links (e.g. "Cached 5 min · sources: ..."). */
  sub?: string;
  /** Whether to show the full nav or a minimal footer. */
  minimal?: boolean;
}

export default function SiteFooter({ sub, minimal = false }: SiteFooterProps) {
  return (
    <footer className="mt-12 border-t border-[color:var(--border)] pt-8 pb-10">
      <div className="mx-auto max-w-[600px] px-4">
        {/* Logo / brand */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 font-bebas text-xs tracking-wider text-[color:var(--accent)]">
            B/S
          </span>
          <span className="font-bebas text-base tracking-wider text-[color:var(--muted)]">
            BUYORBESOLD
          </span>
        </div>

        {/* Nav links */}
        {!minimal && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)] xs:gap-x-5 xs:text-[11px]">
            <Link href="/dashboard" className="hover:text-[color:var(--accent)] transition-colors">Dashboard</Link>
            <Link href="/scanner" className="hover:text-[color:var(--accent)] transition-colors">Scanner</Link>
            <Link href="/journal" className="hover:text-[color:var(--accent)] transition-colors">Journal</Link>
            <Link href="/rankings" className="hover:text-[color:var(--accent)] transition-colors">Rankings</Link>
            <Link href="/briefings" className="hover:text-[color:var(--accent)] transition-colors">Briefings</Link>
            <Link href="/newsletter" className="hover:text-[color:var(--accent)] transition-colors">Newsletter</Link>
          </div>
        )}

        {/* Divider */}
        <div className="mx-auto mb-4 h-px w-16 bg-[color:var(--border)]" />

        {/* Legal links */}
        <div className="flex items-center justify-center gap-4 mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]/60">
          <Link href="/legal/privacy" className="hover:text-[color:var(--accent)] transition-colors">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-[color:var(--accent)] transition-colors">Terms</Link>
        </div>

        {/* Sub text */}
        {sub && (
          <p className="mb-2 text-center font-mono text-[10px] text-[color:var(--muted)]/50 leading-relaxed">
            {sub}
          </p>
        )}

        {/* Disclaimer + copyright */}
        <p className="text-center font-mono text-[10px] text-[color:var(--muted)]/40 leading-relaxed">
          Not financial advice. Do your own research. &copy; {new Date().getFullYear()} BuyOrBeSold.com
        </p>
      </div>
    </footer>
  );
}
