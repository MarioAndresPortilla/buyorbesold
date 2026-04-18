"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Sector } from "@/lib/types";

interface SectorHeatmapProps {
  sectors: Sector[];
}

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

  const peakMagnitude = Math.max(0.5, ...sorted.map((s) => Math.abs(s.changePct)));
  const upCount = sorted.filter((s) => s.changePct >= 0).length;
  const downCount = sorted.length - upCount;

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-[color:var(--border)] p-3 sm:p-4"
      style={{
        background: `
          radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--accent) 22%, transparent) 1px, transparent 0),
          linear-gradient(180deg, color-mix(in oklab, var(--bg) 92%, black), var(--bg))
        `,
        backgroundSize: "14px 14px, 100% 100%",
      }}
    >
      <CornerBrackets />

      {/* Header readout — like a chip label / PCB silkscreen */}
      <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[color:var(--border)] pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--muted)] xs:text-[10px]">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
            style={{
              background: "var(--accent)",
              boxShadow: "0 0 6px var(--accent), 0 0 2px var(--accent)",
            }}
          />
          <span className="font-bold text-[color:var(--accent)]">SECTOR.ARRAY</span>
          <span className="opacity-60">v1.0</span>
          <span className="opacity-40">∙</span>
          <span>{sorted.length} nodes</span>
          <span className="opacity-40">∙</span>
          <span>
            peak <span className="text-[color:var(--text)]">±{peakMagnitude.toFixed(2)}%</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--up)", boxShadow: "0 0 4px var(--up)" }}
            />
            <span>{upCount}</span>
          </span>
          <span className="opacity-40">/</span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--down)", boxShadow: "0 0 4px var(--down)" }}
            />
            <span>{downCount}</span>
          </span>
          <span className="opacity-40">∙</span>
          <span className="flex items-center gap-1.5">
            <span>−</span>
            <span className="flex overflow-hidden rounded-[2px] border border-[color:var(--border)]">
              <LegendSwatch pct={-peakMagnitude} peak={peakMagnitude} />
              <LegendSwatch pct={-peakMagnitude * 0.5} peak={peakMagnitude} />
              <LegendSwatch pct={0} peak={peakMagnitude} />
              <LegendSwatch pct={peakMagnitude * 0.5} peak={peakMagnitude} />
              <LegendSwatch pct={peakMagnitude} peak={peakMagnitude} />
            </span>
            <span>+</span>
          </span>
        </div>
      </div>

      {/* Chip grid */}
      <div
        className="relative grid gap-2 sm:gap-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))" }}
      >
        {sorted.map((s, idx) => (
          <ChipTile key={s.code} sector={s} peak={peakMagnitude} index={idx} />
        ))}
      </div>

      {/* Footer trace line — fake circuit path */}
      <div
        className="mt-3 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.25em] text-[color:var(--muted)] xs:text-[9px]"
        aria-hidden="true"
      >
        <span>BUS</span>
        <span
          className="block h-px flex-1"
          style={{
            background:
              "repeating-linear-gradient(90deg, color-mix(in oklab, var(--accent) 50%, transparent) 0 6px, transparent 6px 10px)",
          }}
        />
        <span>◇</span>
        <span
          className="block h-px flex-1"
          style={{
            background:
              "repeating-linear-gradient(90deg, color-mix(in oklab, var(--accent) 50%, transparent) 0 6px, transparent 6px 10px)",
          }}
        />
        <span>OUT</span>
      </div>
    </div>
  );
}

function chipColors(pct: number, peak: number) {
  const up = pct >= 0;
  const intensity = Math.min(Math.abs(pct) / peak, 1);
  const alpha = 0.14 + intensity * 0.58;
  const base = up ? "var(--up)" : "var(--down)";
  return {
    bg: `color-mix(in oklab, ${base} ${Math.round(alpha * 100)}%, var(--surface))`,
    glow: base,
    border: `color-mix(in oklab, ${base} ${Math.round(35 + intensity * 45)}%, var(--border))`,
    intensity,
    up,
  };
}

function ChipTile({
  sector,
  peak,
  index,
}: {
  sector: Sector;
  peak: number;
  index: number;
}) {
  const { bg, glow, border, intensity, up } = chipColors(sector.changePct, peak);
  const idLabel = `${String(index + 1).padStart(2, "0")}`;

  return (
    <Link
      href={`/sectors/${encodeURIComponent(sector.code.toLowerCase())}`}
      aria-label={`${sector.name}: ${up ? "+" : ""}${sector.changePct.toFixed(2)}% — view breakdown`}
      className="group relative flex aspect-[5/4] flex-col overflow-hidden rounded-md border transition-all duration-200 hover:z-10 hover:scale-[1.04] focus:z-10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
      style={
        {
          background: bg,
          borderColor: border,
          "--chip-glow": glow,
        } as React.CSSProperties
      }
      title={`${sector.name}: ${up ? "+" : ""}${sector.changePct.toFixed(2)}% — click for breakdown`}
    >
      {/* Chip pins — top & bottom edges */}
      <ChipPins side="top" color={border} />
      <ChipPins side="bottom" color={border} />

      {/* Corner brackets */}
      <span
        className="pointer-events-none absolute left-1 top-1 h-1.5 w-1.5 border-l border-t"
        style={{ borderColor: glow }}
      />
      <span
        className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 border-r border-t"
        style={{ borderColor: glow }}
      />
      <span
        className="pointer-events-none absolute bottom-1 left-1 h-1.5 w-1.5 border-b border-l"
        style={{ borderColor: glow }}
      />
      <span
        className="pointer-events-none absolute bottom-1 right-1 h-1.5 w-1.5 border-b border-r"
        style={{ borderColor: glow }}
      />

      {/* Hover glow overlay */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          boxShadow: `inset 0 0 24px color-mix(in oklab, ${glow} 55%, transparent)`,
        }}
      />

      {/* Header: LED + chip ID + sector code */}
      <div className="relative z-10 flex items-center justify-between px-2.5 pt-3 sm:pt-3.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
            style={{
              background: glow,
              boxShadow: `0 0 6px ${glow}, 0 0 2px ${glow}`,
            }}
          />
          <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--text)] sm:text-[11px]">
            {sector.code}
          </span>
        </div>
        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-[color:var(--muted)] sm:text-[9px]">
          IC.{idLabel}
        </span>
      </div>

      {/* Sector name */}
      <div className="relative z-10 px-2.5 pt-0.5">
        <div className="line-clamp-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--muted)] sm:text-[10px]">
          {sector.name}
        </div>
      </div>

      {/* Big number — high contrast with glow for readability */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-2 py-1">
        <span
          className="font-bebas text-[26px] font-normal leading-none tracking-wide sm:text-[30px]"
          style={{
            color: "#ffffff",
            textShadow: `0 0 10px ${glow}, 0 0 2px ${glow}, 0 1px 0 rgba(0,0,0,0.4)`,
          }}
        >
          {up ? "+" : ""}
          {sector.changePct.toFixed(2)}
          <span className="text-[55%] opacity-80">%</span>
        </span>
      </div>

      {/* LED segment intensity bar */}
      <div className="relative z-10 mb-2 px-2.5">
        <div
          className="relative h-1 w-full overflow-hidden rounded-sm"
          style={{ background: "color-mix(in oklab, black 55%, transparent)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.max(4, intensity * 100)}%`,
              background: glow,
              boxShadow: `0 0 6px ${glow}`,
            }}
          />
          {/* Segment divider ticks */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0,0,0,0.55) calc(10% - 1px) 10%)",
            }}
          />
        </div>
      </div>
    </Link>
  );
}

function ChipPins({ side, color }: { side: "top" | "bottom"; color: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-3 right-3 h-[3px] ${
        side === "top" ? "top-0" : "bottom-0"
      }`}
      style={{
        background: `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 9px)`,
        opacity: 0.9,
      }}
    />
  );
}

function LegendSwatch({ pct, peak }: { pct: number; peak: number }) {
  const { bg } = chipColors(pct, peak);
  return <span className="block h-2.5 w-3.5" style={{ background: bg }} />;
}

function CornerBrackets() {
  const s = "pointer-events-none absolute h-2.5 w-2.5";
  return (
    <>
      <span
        aria-hidden="true"
        className={`${s} left-1 top-1 border-l border-t`}
        style={{ borderColor: "color-mix(in oklab, var(--accent) 55%, transparent)" }}
      />
      <span
        aria-hidden="true"
        className={`${s} right-1 top-1 border-r border-t`}
        style={{ borderColor: "color-mix(in oklab, var(--accent) 55%, transparent)" }}
      />
      <span
        aria-hidden="true"
        className={`${s} bottom-1 left-1 border-b border-l`}
        style={{ borderColor: "color-mix(in oklab, var(--accent) 55%, transparent)" }}
      />
      <span
        aria-hidden="true"
        className={`${s} bottom-1 right-1 border-b border-r`}
        style={{ borderColor: "color-mix(in oklab, var(--accent) 55%, transparent)" }}
      />
    </>
  );
}
