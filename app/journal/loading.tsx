import { Shimmer, SkeletonStatCard } from "@/components/Skeleton";
import SiteNav from "@/components/SiteNav";

export default function JournalLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[1100px]" />

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 xs:py-10">
        {/* Header */}
        <div>
          <Shimmer className="h-6 w-40 rounded-full" />
          <Shimmer className="mt-4 h-12 w-64" />
          <Shimmer className="mt-3 h-3 w-96 max-w-full" />
        </div>

        {/* Stats strip */}
        <section className="grid grid-cols-2 gap-3 xs:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </section>

        {/* Trade rows */}
        <section>
          <Shimmer className="mb-3 h-7 w-36" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Shimmer className="h-7 w-16" />
                      <Shimmer className="h-5 w-12 rounded-full" />
                      <Shimmer className="h-5 w-20 rounded-full" />
                    </div>
                    <Shimmer className="h-2.5 w-40" />
                  </div>
                  <Shimmer className="h-8 w-20" />
                </div>
                <Shimmer className="mt-3 h-3 w-full" />
                <Shimmer className="mt-1 h-3 w-3/4" />
                <div className="mt-3 flex gap-4 border-t border-[color:var(--border)]/60 pt-3">
                  <Shimmer className="h-3 w-16" />
                  <Shimmer className="h-3 w-16" />
                  <Shimmer className="h-3 w-16" />
                  <Shimmer className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
