import type { Sector } from "@/lib/types";

interface SectorHeatmapProps {
  sectors: Sector[];
}

export default function SectorHeatmap({ sectors }: SectorHeatmapProps) {
  if (!sectors.length) {
    return (
      <div className="rounded-lg border border-[color:var(--border)] p-6 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
        Sector data unavailable
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 xs:grid-cols-3 sm:grid-cols-5">
      {sectors.map((s) => {
        const up = s.changePct >= 0;
        const intensity = Math.min(Math.abs(s.changePct) / 3, 1);
        const bg = up
          ? `color-mix(in oklab, var(--up) ${Math.round(intensity * 55) + 8}%, transparent)`
          : `color-mix(in oklab, var(--down) ${Math.round(intensity * 55) + 8}%, transparent)`;
        return (
          <div
            key={s.code}
            title={`${s.name}: ${up ? "+" : ""}${s.changePct.toFixed(2)}%`}
            className="flex min-w-0 flex-col justify-between rounded-lg border border-[color:var(--border)] p-3"
            style={{ background: bg }}
          >
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
              {s.code}
            </div>
            <div
              className="mt-2 font-mono text-base font-bold xs:text-lg"
              style={{ color: up ? "var(--up)" : "var(--down)" }}
            >
              {up ? "+" : ""}
              {s.changePct.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
