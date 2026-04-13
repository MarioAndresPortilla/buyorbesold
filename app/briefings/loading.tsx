import { Shimmer } from "@/components/Skeleton";
import SiteNav from "@/components/SiteNav";

export default function BriefingsLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[900px]" />

      <main className="mx-auto max-w-[900px] px-4 py-10 xs:py-12">
        <Shimmer className="h-10 w-40" />
        <Shimmer className="mt-3 h-3 w-48" />

        {/* Tag chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>

        {/* Brief list items */}
        <div className="mt-10 divide-y divide-[color:var(--border)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-6">
              <Shimmer className="h-2.5 w-48" />
              <Shimmer className="mt-3 h-8 w-3/4" />
              <Shimmer className="mt-3 h-3 w-full" />
              <Shimmer className="mt-2 h-3 w-5/6" />
              <Shimmer className="mt-4 h-3 w-24" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
