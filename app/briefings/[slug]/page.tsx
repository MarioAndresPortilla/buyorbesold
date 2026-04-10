import Link from "next/link";
import { notFound } from "next/navigation";
import { BRIEFS, getBriefBySlug } from "@/lib/briefs";
import NewsletterSignup from "@/components/NewsletterSignup";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return BRIEFS.map((b) => ({ slug: b.slug }));
}

export function generateMetadata({ params }: PageProps) {
  const brief = getBriefBySlug(params.slug);
  if (!brief) return { title: "Brief not found — BuyOrBeSold" };
  return {
    title: `${brief.title} — BuyOrBeSold`,
    description: brief.summary,
  };
}

export default function BriefPage({ params }: PageProps) {
  const brief = getBriefBySlug(params.slug);
  if (!brief) notFound();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-lg tracking-wider text-[color:var(--accent)]">
              B/S
            </span>
            <span className="font-bebas text-xl tracking-wider">BUYORBESOLD</span>
          </Link>
          <nav className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            <Link href="/briefings" className="hover:text-[color:var(--accent)]">
              All briefs
            </Link>
            <Link href="/dashboard" className="hover:text-[color:var(--accent)]">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-12">
        <Link
          href="/briefings"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--muted)] hover:text-[color:var(--accent)]"
        >
          ← All briefings
        </Link>

        <div className="mt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            {brief.date} · {brief.tags.join(" · ")}
          </div>
          <h1 className="mt-2 font-bebas text-5xl leading-[0.95] tracking-wide text-[color:var(--text)] sm:text-6xl">
            {brief.title}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[color:var(--muted)]">
            {brief.summary}
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Mario's take
          </div>
          <p className="text-[15px] leading-relaxed text-[color:var(--text)]">
            {brief.take}
          </p>
        </div>

        <div className="mt-10">
          <NewsletterSignup
            heading="Get the next brief in your inbox"
            sub="One email each weekday. Same voice, same format, no spam."
          />
        </div>

        <footer className="mt-16 border-t border-[color:var(--border)] pt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Not financial advice. Do your own research.
        </footer>
      </main>
    </div>
  );
}
