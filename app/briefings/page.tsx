import Link from "next/link";
import { getAllTags, getBriefs } from "@/lib/briefs";

export const metadata = {
  title: "Briefings",
  description: "Archive of all BuyOrBeSold daily market briefings.",
};

interface PageProps {
  searchParams: { tag?: string };
}

export default function BriefingsIndexPage({ searchParams }: PageProps) {
  const selectedTag = searchParams.tag?.toLowerCase();
  const allBriefs = getBriefs();
  const briefs = selectedTag
    ? allBriefs.filter((b) => b.tags.map((t) => t.toLowerCase()).includes(selectedTag))
    : allBriefs;
  const tags = getAllTags();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-2 px-3 py-3 xs:gap-3 xs:px-4 xs:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 xs:gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)] xs:h-9 xs:w-9 xs:text-lg">
              B/S
            </span>
            <span className="truncate font-bebas text-lg tracking-wider xs:text-xl">BUYORBESOLD</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)] xs:gap-4 xs:text-[11px] xs:tracking-[0.15em]">
            <Link href="/scanner" className="hover:text-[color:var(--accent)]">
              Scanner
            </Link>
            <Link href="/journal" className="hover:text-[color:var(--accent)]">
              Journal
            </Link>
            <Link href="/dashboard" className="hidden hover:text-[color:var(--accent)] xs:inline">
              Dash<span className="hidden xs:inline">board</span>
            </Link>
          </nav>
        </div>
      </header>

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

        <footer className="mt-16 border-t border-[color:var(--border)] pt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Not financial advice. Do your own research.
        </footer>
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
