import Link from "next/link";
import { getAllBriefs, getAllTagsAsync } from "@/lib/briefs";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Briefings",
  description: "Archive of all BuyOrBeSold daily market briefings.",
};

interface PageProps {
  searchParams: Promise<{ tag?: string }>;
}

export default async function BriefingsIndexPage({ searchParams }: PageProps) {
  const { tag } = await searchParams;
  const selectedTag = tag?.toLowerCase();
  const allBriefs = await getAllBriefs();
  const briefs = selectedTag
    ? allBriefs.filter((b) => b.tags.map((t) => t.toLowerCase()).includes(selectedTag))
    : allBriefs;
  const tags = await getAllTagsAsync();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[900px]" />

      <main className="mx-auto max-w-[900px] px-4 py-10 xs:py-12">
        <h1 className="font-bebas text-4xl tracking-wide xs:text-5xl">Briefings</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--muted)] xs:text-[12px]">
          Every daily brief, archived.
        </p>

        {tags.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <TagChip href="/briefings" active={!selectedTag} label="All" count={allBriefs.length} />
            {tags.map(({ tag, count }) => (
              <TagChip
                key={tag}
                href={`/briefings?tag=${encodeURIComponent(tag)}`}
                active={selectedTag === tag.toLowerCase()}
                label={tag}
                count={count}
              />
            ))}
          </div>
        )}

        {briefs.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-10 text-center">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
              {selectedTag ? `No briefs tagged "${selectedTag}" yet` : "No briefs published yet"}
            </div>
            {selectedTag && (
              <Link
                href="/briefings"
                className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--accent)] hover:underline"
              >
                ← Back to all briefs
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-10 divide-y divide-[color:var(--border)]">
            {briefs.map((b) => (
              <li key={b.slug} className="py-6">
                <Link href={`/briefings/${b.slug}`} className="group block">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    <span className="text-[color:var(--accent)]">{b.date}</span>
                    {b.type && b.type !== "brief" && (
                      <span className="rounded border border-[color:var(--accent)] bg-[color:var(--accent)]/10 px-1.5 py-0.5 font-bold tracking-wider text-[color:var(--accent)]">
                        {b.type}
                      </span>
                    )}
                    {b.tags.map((tag) => (
                      <span key={tag} className="before:mr-2 before:content-['\\00b7']">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="mt-2 font-bebas text-2xl leading-tight tracking-wide text-[color:var(--text)] group-hover:text-[color:var(--accent)] xs:text-3xl">
                    {b.title}
                  </h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--muted)] xs:text-[14px]">
                    {b.summary}
                  </p>
                  <span className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--accent)]">
                    Read brief →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <SiteFooter minimal />
      </main>
    </div>
  );
}

function TagChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/20 text-[color:var(--accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
      }`}
    >
      {label}
      <span className="ml-1 opacity-60">({count})</span>
    </Link>
  );
}
