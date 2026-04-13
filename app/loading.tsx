import { Shimmer, SkeletonCard, SkeletonGauge } from "@/components/Skeleton";
import SiteNav from "@/components/SiteNav";

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav />

      {/* Hero skeleton */}
      <section className="border-b border-[color:var(--border)]">
        <div className="mx-auto max-w-[1200px] px-4 py-12 text-center xs:py-16 sm:py-24">
          <Shimmer className="mx-auto h-6 w-36 rounded-full" />
          <Shimmer className="mx-auto mt-6 h-16 w-3/4 xs:h-20" />
          <Shimmer className="mx-auto mt-4 h-10 w-2/3" />
          <Shimmer className="mx-auto mt-6 h-4 w-96 max-w-full" />
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 xs:flex-row xs:items-center">
            <Shimmer className="h-12 w-48 rounded-md" />
            <Shimmer className="h-12 w-48 rounded-md" />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1200px] space-y-10 px-4 py-12">
        {/* Snapshot row */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <Shimmer className="h-7 w-40" />
            <Shimmer className="h-3 w-24" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </section>

        {/* Brief + Fear & Greed */}
        <section className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="mt-4 h-10 w-3/4" />
            <Shimmer className="mt-4 h-3 w-full" />
            <Shimmer className="mt-2 h-3 w-5/6" />
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <Shimmer className="mb-3 h-3 w-24" />
            <SkeletonGauge size={200} />
          </div>
        </section>
      </main>
    </div>
  );
}
