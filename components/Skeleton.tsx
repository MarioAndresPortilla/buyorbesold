/**
 * Reusable skeleton / shimmer primitives for loading states.
 * Used inside loading.tsx files (Next.js Suspense boundaries) and inline
 * wherever a component needs a placeholder while data streams in.
 */

export function Shimmer({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[color:var(--border)]/60 ${className}`}
      style={style}
      aria-hidden
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <Shimmer className="h-2.5 w-16" />
          <Shimmer className="h-4 w-12" />
        </div>
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>
      <Shimmer className="mt-4 h-8 w-28" />
      <Shimmer className="mt-4 h-12 w-full" />
      <Shimmer className="mt-3 h-4 w-full" />
      <div className="mt-3 flex justify-between border-t border-[color:var(--border)]/60 pt-3">
        <Shimmer className="h-2.5 w-16" />
        <Shimmer className="h-2.5 w-16" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <Shimmer className="h-2.5 w-16" />
      <Shimmer className="mt-2 h-8 w-20" />
      <Shimmer className="mt-1 h-2 w-12" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Shimmer className="h-4 w-14" />
      <Shimmer className="h-8 flex-1" />
      <div className="text-right">
        <Shimmer className="h-4 w-16" />
        <Shimmer className="mt-1 h-2.5 w-12" />
      </div>
    </div>
  );
}

export function SkeletonGauge({ size = 220 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Shimmer className="rounded-full" style={{ width: size, height: size * 0.55 }} />
      <Shimmer className="h-10 w-14" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}

/**
 * Full-page loading shell that matches the site's header + content area.
 */
export function PageSkeleton({
  title = true,
  cards = 0,
  rows = 4,
}: {
  title?: boolean;
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      {title && (
        <div>
          <Shimmer className="h-3 w-28" />
          <Shimmer className="mt-3 h-10 w-64 xs:w-80" />
          <Shimmer className="mt-3 h-3 w-full max-w-md" />
        </div>
      )}
      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}
      {rows > 0 && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <Shimmer className="mb-4 h-6 w-32" />
          <div className="divide-y divide-[color:var(--border)]/70">
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
