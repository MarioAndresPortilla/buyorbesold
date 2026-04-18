import Link from "next/link";
import { getAllBriefs, getAllTagsAsync } from "@/lib/briefs";
import { formatBriefDate } from "@/lib/format";
import type { Brief } from "@/lib/types";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Briefings",
  description: "Archive of all BuyOrBeSold daily market briefings.",
};

interface PageProps {
  searchParams: Promise<{ tag?: string; page?: string }>;
}

const PAGE_SIZE = 10;

export default async function BriefingsIndexPage({ searchParams }: PageProps) {
  const { tag, page: pageRaw } = await searchParams;
  const selectedTag = tag?.toLowerCase();
  const allBriefs = await getAllBriefs();
  const filtered = selectedTag
    ? allBriefs.filter((b) => b.tags.map((t) => t.toLowerCase()).includes(selectedTag))
    : allBriefs;
  const tags = await getAllTagsAsync();

  // Clamp the page to a valid range so a bogus `?page=` doesn't render empty.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const parsedPage = Number(pageRaw);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.min(Math.floor(parsedPage), totalPages)
      : 1;
  const start = (page - 1) * PAGE_SIZE;
  const briefs = filtered.slice(start, start + PAGE_SIZE);

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
          <>
          <div className="mt-10 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            <span>
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            {totalPages > 1 && (
              <span>
                Page {page} / {totalPages}
              </span>
            )}
          </div>
          <ul className="mt-4 divide-y divide-[color:var(--border)]">
            {briefs.map((b) => (
              <li key={b.slug} className="py-6">
                <Link href={`/briefings/${b.slug}`} className="group block">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    <time
                      dateTime={b.publishedAt ?? b.date}
                      className="text-[color:var(--accent)]"
                    >
                      {formatBriefDate(b)}
                    </time>
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

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              selectedTag={selectedTag}
              pages={filtered}
              pageSize={PAGE_SIZE}
            />
          )}
          </>
        )}

        <SiteFooter minimal />
      </main>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  selectedTag,
  pages,
  pageSize,
}: {
  page: number;
  totalPages: number;
  selectedTag?: string;
  pages: Brief[];
  pageSize: number;
}) {
  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (selectedTag) params.set("tag", selectedTag);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/briefings?${qs}` : "/briefings";
  };

  // Date-range hint for each page (first + last brief on that page) so the
  // pagination reads like an archive index instead of naked page numbers.
  const rangeLabel = (p: number): string => {
    const start = (p - 1) * pageSize;
    const end = Math.min(start + pageSize, pages.length);
    const newest = pages[start]?.date ?? "";
    const oldest = pages[end - 1]?.date ?? newest;
    if (!newest) return `Page ${p}`;
    const fmt = (d: string) => {
      const [y, m, day] = d.slice(0, 10).split("-").map(Number);
      if (!y) return d;
      const dt = new Date(Date.UTC(y, m - 1, day));
      return dt.toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      });
    };
    return newest === oldest ? fmt(newest) : `${fmt(newest)} – ${fmt(oldest)}`;
  };

  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  // Short numeric strip: current ±1, plus first/last with ellipses.
  const numeric: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      numeric.push(i);
    } else if (numeric[numeric.length - 1] !== "ellipsis") {
      numeric.push("ellipsis");
    }
  }

  return (
    <nav
      aria-label="Briefings pagination"
      className="mt-8 flex flex-col items-center gap-4 border-t border-[color:var(--border)] pt-6 sm:flex-row sm:justify-between"
    >
      <div className="flex items-center gap-2">
        <PageLink href={prev ? buildHref(prev) : null} label="← Newer" />
        <PageLink href={next ? buildHref(next) : null} label="Older →" />
      </div>

      <ol className="flex flex-wrap items-center justify-center gap-1">
        {numeric.map((n, i) =>
          n === "ellipsis" ? (
            <li
              key={`e-${i}`}
              className="px-2 font-mono text-[11px] text-[color:var(--muted)]"
            >
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={buildHref(n)}
                aria-current={n === page ? "page" : undefined}
                className={`flex min-w-[2rem] items-center justify-center rounded-md border px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  n === page
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/20 text-[color:var(--accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                }`}
                title={rangeLabel(n)}
              >
                {n}
              </Link>
            </li>
          )
        )}
      </ol>

      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
        {rangeLabel(page)}
      </span>
    </nav>
  );
}

function PageLink({ href, label }: { href: string | null; label: string }) {
  const base =
    "rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] transition-colors";
  if (!href) {
    return (
      <span
        aria-disabled
        className={`${base} cursor-not-allowed border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--subtle)] opacity-50`}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]`}
    >
      {label}
    </Link>
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
