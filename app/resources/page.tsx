import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import {
  linkHref,
  loadResources,
  type ResourceItem,
  type ResourceKind,
} from "@/lib/resources";

export const metadata: Metadata = {
  title: "Tools & Resources — BuyOrBeSold",
  description:
    "Mario's stack: bullion dealers, brokers, charting, data, and reading. Some links are affiliates — only things we actually use. Not financial advice.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  const data = loadResources();
  const populated = data.categories.filter((c) => c.items.length > 0);
  const hasAffiliate = populated.some((c) =>
    c.items.some((i) => i.kind === "affiliate")
  );

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[1100px]" />
      <Breadcrumbs
        maxWidth="max-w-[1100px]"
        items={[
          { href: "/", label: "Home" },
          { label: "Resources" },
        ]}
      />

      <main className="mx-auto max-w-[1100px] space-y-8 px-4 py-8 xs:py-10">
        <section>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Mario's Stack
          </div>
          <h1 className="font-bebas text-[44px] leading-none tracking-wide xs:text-5xl sm:text-6xl">
            Tools &amp; Resources
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)] xs:text-[14px]">
            The brokers, dealers, charting tools, and data feeds I actually
            use — not a link farm. If I don't open it at least weekly, it
            doesn't belong on this page.
          </p>

          {hasAffiliate && data.disclosure && (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 font-mono text-[11px] leading-relaxed text-amber-300">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">
                Affiliate disclosure
              </div>
              {data.disclosure}
            </div>
          )}
        </section>

        {populated.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-10 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
            No resources listed yet — check back soon.
          </div>
        ) : (
          populated.map((cat) => (
            <section key={cat.code} id={cat.code}>
              <div className="mb-4 border-b border-[color:var(--border)] pb-2">
                <h2 className="font-bebas text-3xl tracking-wide xs:text-4xl">
                  <span className="text-[color:var(--accent)]">▸</span>{" "}
                  {cat.name}
                </h2>
                {cat.blurb && (
                  <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[color:var(--muted)]">
                    {cat.blurb}
                  </p>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {cat.items.map((item) => (
                  <ResourceCard key={`${cat.code}-${item.name}`} item={item} />
                ))}
              </div>
            </section>
          ))
        )}

        <SiteFooter sub="Some links are affiliates · We only list what we use · Not financial advice." />
      </main>
    </div>
  );
}

function ResourceCard({ item }: { item: ResourceItem }) {
  const href = linkHref(item);
  const isAffiliate = item.kind === "affiliate";
  // FTC: sponsored affiliate links should carry rel="sponsored". Browsers
  // that don't recognize it fall back to the nofollow hint — Google itself
  // documents both as equivalent signals for commercial intent links.
  // https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links
  const rel = isAffiliate
    ? "sponsored nofollow noopener noreferrer"
    : "noopener noreferrer";

  return (
    <a
      href={href}
      target="_blank"
      rel={rel}
      className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 transition-colors hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bebas text-2xl leading-none tracking-wide text-[color:var(--text)] group-hover:text-[color:var(--accent)]">
            {item.name}
          </h3>
          <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {hostnameOf(item.url)}
          </div>
        </div>
        <KindBadge kind={item.kind} />
      </div>

      <p className="text-[13px] leading-relaxed text-[color:var(--muted)]">
        {item.blurb}
      </p>

      {item.bestFor && (
        <div className="mt-auto border-t border-[color:var(--border)]/60 pt-2 font-mono text-[10px] uppercase tracking-wider">
          <span className="text-[color:var(--muted)]">Best for:</span>{" "}
          <span className="text-[color:var(--text)]">{item.bestFor}</span>
        </div>
      )}

      <span
        aria-hidden
        className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--accent)]"
      >
        Visit site ↗
      </span>
    </a>
  );
}

function KindBadge({ kind }: { kind: ResourceKind }) {
  const style =
    kind === "affiliate"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
      : kind === "paid"
        ? "border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
        : "border-[color:var(--border)] bg-[color:var(--surface-2)] text-[color:var(--muted)]";
  const label =
    kind === "affiliate" ? "Affiliate" : kind === "paid" ? "Paid" : "Free";
  return (
    <span
      className={`shrink-0 self-start rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${style}`}
    >
      {label}
    </span>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
