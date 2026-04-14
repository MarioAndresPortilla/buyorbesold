import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRIEFS, getBriefBySlug, getBriefBySlugAsync } from "@/lib/briefs";
import NewsletterSignup from "@/components/NewsletterSignup";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import BriefBody from "@/components/BriefBody";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.vercel.app";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return BRIEFS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brief = await getBriefBySlugAsync(slug);
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

export default async function BriefPage({ params }: PageProps) {
  const { slug } = await params;
  const brief = await getBriefBySlugAsync(slug);
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
      <SiteNav
        maxWidth="max-w-[760px]"
        links={[
          { href: "/briefings", label: "All briefs", short: "Briefs" },
          { href: "/scanner", label: "Scanner" },
          { href: "/journal", label: "Journal", hideBelow: "xs" },
        ]}
      />

      <main className="mx-auto max-w-[760px] px-4 py-10 xs:py-12">
        <Link
          href="/briefings"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--muted)] hover:text-[color:var(--accent)]"
        >
          ← All briefings
        </Link>

        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            <span>{brief.date}</span>
            {brief.type && brief.type !== "brief" && (
              <span className="rounded border border-[color:var(--accent)] bg-[color:var(--accent)]/10 px-1.5 py-0.5 font-bold tracking-wider text-[color:var(--accent)]">
                {brief.type}
              </span>
            )}
            {brief.tags.length > 0 && (
              <span>· {brief.tags.join(" · ")}</span>
            )}
          </div>
          <h1 className="mt-2 font-bebas text-[36px] leading-[0.95] tracking-wide text-[color:var(--text)] xs:text-5xl sm:text-6xl">
            {brief.title}
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed text-[color:var(--muted)] xs:text-lg">
            {brief.summary}
          </p>
          {brief.type === "earnings" && brief.meta && (
            <EarningsMetaCard meta={brief.meta as Record<string, unknown>} />
          )}
        </div>

        <div className="mt-8 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Mario's take
          </div>
          <BriefBody text={brief.take} className="text-[15px]" />
        </div>

        <div className="mt-10">
          <NewsletterSignup
            heading="Get the next brief in your inbox"
            sub="One email each weekday. Same voice, same format, no spam."
          />
        </div>

        <SiteFooter minimal />
      </main>
    </div>
  );
}

/**
 * Renders an EPS + revenue beat-or-miss card for `type: earnings` briefs.
 * Accepts the raw `meta` object from frontmatter and safely extracts the
 * numeric fields. Renders nothing if no earnings fields are present.
 */
function EarningsMetaCard({ meta }: { meta: Record<string, unknown> }) {
  const ticker = typeof meta.ticker === "string" ? meta.ticker : null;
  const quarter = typeof meta.quarter === "string" ? meta.quarter : null;
  const epsActual =
    typeof meta.epsActual === "number" ? meta.epsActual : null;
  const epsEst = typeof meta.epsEst === "number" ? meta.epsEst : null;
  const revActual =
    typeof meta.revActual === "number" ? meta.revActual : null;
  const revEst = typeof meta.revEst === "number" ? meta.revEst : null;

  if (!ticker && !quarter && epsActual === null && revActual === null) {
    return null;
  }

  const epsBeat =
    epsActual !== null && epsEst !== null ? epsActual - epsEst : null;
  const revBeat =
    revActual !== null && revEst !== null ? revActual - revEst : null;
  const fmtRev = (r: number) => `$${(r / 1e9).toFixed(2)}B`;

  return (
    <div className="mt-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      {(ticker || quarter) && (
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
          {ticker}
          {quarter ? ` · ${quarter}` : ""}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {epsActual !== null && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
              EPS
            </div>
            <div className="mt-1 font-mono text-[15px] text-[color:var(--text)]">
              {epsActual.toFixed(2)}
              {epsEst !== null && (
                <span className="ml-2 text-[11px] text-[color:var(--muted)]">
                  est {epsEst.toFixed(2)}
                </span>
              )}
            </div>
            {epsBeat !== null && (
              <div
                className={`mt-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  epsBeat >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {epsBeat >= 0 ? "beat" : "miss"} {Math.abs(epsBeat).toFixed(2)}
              </div>
            )}
          </div>
        )}
        {revActual !== null && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
              Revenue
            </div>
            <div className="mt-1 font-mono text-[15px] text-[color:var(--text)]">
              {fmtRev(revActual)}
              {revEst !== null && (
                <span className="ml-2 text-[11px] text-[color:var(--muted)]">
                  est {fmtRev(revEst)}
                </span>
              )}
            </div>
            {revBeat !== null && (
              <div
                className={`mt-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  revBeat >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {revBeat >= 0 ? "beat" : "miss"} {fmtRev(Math.abs(revBeat))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
