import { Shimmer, SkeletonCard, SkeletonRow } from "@/components/Skeleton";
import SiteNav from "@/components/SiteNav";

export default function ScannerLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav />

      <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-8 xs:py-10">
        {/* Title row */}
        <section className="flex flex-col gap-3 xs:flex-row xs:items-end xs:justify-between">
          <div>
            <Shimmer className="h-6 w-48 rounded-full" />
            <Shimmer className="mt-4 h-12 w-72" />
            <Shimmer className="mt-3 h-3 w-96 max-w-full" />
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <Shimmer className="h-2.5 w-12" />
            <div className="mt-2 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Shimmer key={i} className="h-3 w-32" />
              ))}
            </div>
          </div>
        </section>

        {/* Top 3 Long cards */}
        <section>
          <Shimmer className="mb-3 h-8 w-52" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </section>

        {/* Top 3 Short cards */}
        <section>
          <Shimmer className="mb-3 h-8 w-52" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </section>

        {/* Watchlist */}
        <section>
          <Shimmer className="mb-3 h-8 w-44" />
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] divide-y divide-[color:var(--border)]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4">
                <SkeletonRow />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
