import { Shimmer, SkeletonCard, SkeletonGauge, SkeletonRow, SkeletonStatCard } from "@/components/Skeleton";
import SiteNav from "@/components/SiteNav";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[1400px]" />

      {/* Ticker tape placeholder */}
      <div className="h-10 w-full animate-pulse border-y border-[color:var(--border)] bg-[#0a0a0a]" />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        {/* Brief + Fear & Greed */}
        <section className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="mt-4 h-10 w-3/4" />
            <Shimmer className="mt-4 h-3 w-full" />
            <Shimmer className="mt-2 h-3 w-5/6" />
            <Shimmer className="mt-6 h-24 w-full rounded-lg" />
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <Shimmer className="mb-3 h-3 w-32" />
            <SkeletonGauge />
          </div>
        </section>

        {/* Main ticker cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </section>

        {/* Index Funds + Commodities */}
        <section className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <Shimmer className="mb-4 h-6 w-28" />
              <div className="divide-y divide-[color:var(--border)]/70">
                {Array.from({ length: 4 }).map((_, j) => (
                  <SkeletonRow key={j} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Heatmap + Calendar */}
        <section className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <Shimmer className="mb-4 h-6 w-28" />
              <div className="grid grid-cols-2 gap-2 xs:grid-cols-3 sm:grid-cols-5">
                {Array.from({ length: 10 }).map((_, j) => (
                  <Shimmer key={j} className="h-16 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
