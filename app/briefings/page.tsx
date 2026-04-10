import Link from "next/link";
import { getBriefs } from "@/lib/briefs";

export const metadata = {
  title: "Briefings — BuyOrBeSold",
  description: "Archive of all BuyOrBeSold daily market briefings.",
};

export default function BriefingsIndexPage() {
  const briefs = getBriefs();
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-lg tracking-wider text-[color:var(--accent)]">
              B/S
            </span>
            <span className="font-bebas text-xl tracking-wider">BUYORBESOLD</span>
          </Link>
          <nav className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            <Link href="/dashboard" className="hover:text-[color:var(--accent)]">
              Dashboard
            </Link>
            <Link href="/newsletter" className="hover:text-[color:var(--accent)]">
              Newsletter
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-4 py-12">
        <h1 className="font-bebas text-5xl tracking-wide">Briefings</h1>
        <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
          Every daily brief, archived.
        </p>

        <ul className="mt-10 divide-y divide-[color:var(--border)]">
          {briefs.map((b) => (
            <li key={b.slug} className="py-6">
              <Link href={`/briefings/${b.slug}`} className="group block">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {b.date} · {b.tags.join(" · ")}
                </div>
                <h2 className="mt-1 font-bebas text-3xl leading-tight tracking-wide text-[color:var(--text)] group-hover:text-[color:var(--accent)]">
                  {b.title}
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--muted)]">
                  {b.summary}
                </p>
                <span className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--accent)]">
                  Read brief →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="mt-16 border-t border-[color:var(--border)] pt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Not financial advice. Do your own research.
        </footer>
      </main>
    </div>
  );
}
