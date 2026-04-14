"use client";

import { useMemo } from "react";
import type { Sector } from "@/lib/types";

interface SectorHeatmapProps {
  sectors: Sector[];
}

/**
 * Market-style sector heatmap. Each sector is a solid tile colored by its
 * % change (intensity scales with magnitude). Grid auto-fits the container
 * so it collapses cleanly from wide desktop down to mobile.
 *
 * Sort: best → worst, so it reads as a ranking top-left to bottom-right
 * the way traders already parse sector tables.
 */
export default function SectorHeatmap({ sectors }: SectorHeatmapProps) {
  const sorted = useMemo(
    () => [...sectors].sort((a, b) => b.changePct - a.changePct),
    [sectors]
  );

  if (!sorted.length) {
    return (
      <div className="rounded-lg border border-[color:var(--border)] p-6 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
        Sector data unavailable
      </div>
    );
  }

  const peakMagnitude = Math.max(
    0.5,
    ...sorted.map((s) => Math.abs(s.changePct))
  );

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)] xs:text-[10px]">
        <span>{sorted.length} sectors · sorted best → worst</span>
        <div className="flex items-center gap-1.5">
          <span>−</span>
          <span className="flex overflow-hidden rounded-sm">
            <LegendSwatch pct={-peakMagnitude} peak={peakMagnitude} />
            <LegendSwatch pct={-peakMagnitude * 0.5} peak={peakMagnitude} />
            <LegendSwatch pct={0} peak={peakMagnitude} />
            <LegendSwatch pct={peakMagnitude * 0.5} peak={peakMagnitude} />
            <LegendSwatch pct={peakMagnitude} peak={peakMagnitude} />
          </span>
          <span>+</span>
        </div>
      </div>

      {/* Tile grid — auto-fit so the layout adapts to whatever width the
          parent Panel happens to give it, on any screen size. */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}
      >
        {sorted.map((s) => (
          <Tile key={s.code} sector={s} peak={peakMagnitude} />
        ))}
      </div>
    </div>
  );
}

/**
 * Map a % change to a background color + text color pair. Intensity scales
 * with |change| relative to the day's peak so a quiet day still reads clearly.
 */
function tileColors(pct: number, peak: number): { bg: string; fg: string; border: string } {
  const up = pct >= 0;
  const intensity = Math.min(Math.abs(pct) / peak, 1);
  // Alpha: 12% (near flat) → 85% (strong move). Wide dynamic range so the
  // biggest movers pop and the rest form a readable gradient.
  const alpha = 0.12 + intensity * 0.73;
  const base = up ? "var(--up)" : "var(--down)";
  return {
    bg: `color-mix(in oklab, ${base} ${Math.round(alpha * 100)}%, var(--surface))`,
    fg: intensity > 0.45
      ? `color-mix(in oklab, ${base} 100%, white 15%)`
      : base,
    border: `color-mix(in oklab, ${base} ${Math.round(30 + intensity * 40)}%, transparent)`,
  };
}

function Tile({ sector, peak }: { sector: Sector; peak: number }) {
  const { bg, fg, border } = tileColors(sector.changePct, peak);
  const up = sector.changePct >= 0;
  return (
    <div
      className="group relative flex aspect-[5/4] flex-col justify-between overflow-hidden rounded-md border p-2 transition-transform duration-150 hover:z-10 hover:scale-[1.03] sm:p-2.5"
      style={{ background: bg, borderColor: border }}
      title={`${sector.name}: ${up ? "+" : ""}${sector.changePct.toFixed(2)}%`}
    >
      <div className="min-w-0">
        <div
          className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--text)] sm:text-[11px]"
        >
          {sector.code}
        </div>
        <div className="mt-0.5 line-clamp-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--muted)] sm:text-[10px]">
          {sector.name}
        </div>
      </div>
      <div
        className="font-bebas text-[22px] leading-none tracking-wide sm:text-[26px]"
        style={{ color: fg }}
      >
        {up ? "+" : ""}
        {sector.changePct.toFixed(2)}
        <span className="text-[60%] opacity-80">%</span>
      </div>
    </div>
  );
}

function LegendSwatch({ pct, peak }: { pct: number; peak: number }) {
  const { bg } = tileColors(pct, peak);
  return <span className="block h-3 w-4" style={{ background: bg }} />;
}
