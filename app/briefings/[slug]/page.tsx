import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRIEFS, getBriefBySlug } from "@/lib/briefs";
import NewsletterSignup from "@/components/NewsletterSignup";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.vercel.app";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return BRIEFS.map((b) => ({ slug: b.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const brief = getBriefBySlug(params.slug);
  if (!brief) return { title: "Brief not found" };
  const url = `${SITE_URL}/briefings/${brief.slug}`;
  return {
    title: brief.title,
    description: brief.summary,
    alternates: { canonical: url },
    openGraph: {
      title: brief.title,
      description: brief.summary,
      url,
      type: "article",
      publishedTime: brief.date,
      authors: ["Mario"],
      tags: brief.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: brief.title,
      description: brief.summary,
    },
  };
}

export default function BriefPage({ params }: PageProps) {
  const brief = getBriefBySlug(params.slug);
  if (!brief) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/briefings/${brief.slug}`,
    },
    headline: brief.title,
    description: brief.summary,
    datePublished: brief.date,
    dateModified: brief.date,
    author: [
      {
        "@type": "Person",
        name: "Mario",
        url: SITE_URL,
      },
    ],
    publisher: {
      "@type": "Organization",
      name: "BuyOrBeSold",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.svg`,
      },
    },
    keywords: brief.tags.join(", "),
    articleSection: "Markets",
    inLanguage: "en-US",
    isAccessibleForFree: true,
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-2 px-3 py-3 xs:gap-3 xs:px-4 xs:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 xs:gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)] xs:h-9 xs:w-9 xs:text-lg">
              B/S
            </span>
            <span className="truncate font-bebas text-lg tracking-wider xs:text-xl">BUYORBESOLD</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)] xs:gap-4 xs:text-[11px] xs:tracking-[0.15em]">
            <Link href="/briefings" className="hover:text-[color:var(--accent)]">
              <span className="xs:hidden">Briefs</span>
              <span className="hidden xs:inline">All briefs</span>
            </Link>
            <Link href="/scanner" className="hover:text-[color:var(--accent)]">
              Scanner
            </Link>
            <Link href="/journal" className="hidden hover:text-[color:var(--accent)] xs:inline">
              Journal
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-10 xs:py-12">
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
          <h1 className="mt-2 font-bebas text-[36px] leading-[0.95] tracking-wide text-[color:var(--text)] xs:text-5xl sm:text-6xl">
            {brief.title}
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed text-[color:var(--muted)] xs:text-lg">
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
