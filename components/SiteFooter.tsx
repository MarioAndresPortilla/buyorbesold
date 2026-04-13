import Link from "next/link";

interface SiteFooterProps {
  /** Extra context text below the nav links (e.g. "Cached 5 min · sources: ..."). */
  sub?: string;
  /** Whether to show the full nav or a minimal footer. */
  minimal?: boolean;
}

export default function SiteFooter({ sub, minimal = false }: SiteFooterProps) {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-[color:var(--border)] pt-6 pb-8 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
      {!minimal && (
        <div className="flex flex-wrap items-center justify-center gap-3 xs:gap-4">
          <Link href="/dashboard" className="hover:text-[color:var(--accent)]">Dashboard</Link>
          <Link href="/scanner" className="hover:text-[color:var(--accent)]">Scanner</Link>
          <Link href="/journal" className="hover:text-[color:var(--accent)]">Journal</Link>
          <Link href="/briefings" className="hover:text-[color:var(--accent)]">Briefings</Link>
          <Link href="/newsletter" className="hover:text-[color:var(--accent)]">Newsletter</Link>
          <a href="/rss.xml" className="hover:text-[color:var(--accent)]">RSS</a>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/legal/privacy" className="hover:text-[color:var(--accent)]">Privacy</Link>
        <Link href="/legal/terms" className="hover:text-[color:var(--accent)]">Terms</Link>
      </div>
      {sub && <div className="normal-case tracking-normal text-[color:var(--muted)]/70">{sub}</div>}
      <div>
        Not financial advice. Do your own research. © {new Date().getFullYear()} BuyOrBeSold.com
      </div>
    </footer>
  );
}
