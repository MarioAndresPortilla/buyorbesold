"use client";

import { useMemo } from "react";
import type { Sector } from "@/lib/types";

interface SectorHeatmapProps {
  sectors: Sector[];
}

/**
 * Sector heatmap styled as a microchip / motherboard PCB.
 *
 * Layout: a central "CPU die" showing the strongest mover, surrounded by
 * sector "pins" connected via SVG circuit traces. The overall shape evokes
 * an IC package viewed from above.
 */
export default function SectorHeatmap({ sectors }: SectorHeatmapProps) {
  if (!sectors.length) {
    return (
      <div className="rounded-lg border border-[color:var(--border)] p-6 text-center font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
        Sector data unavailable
      </div>
    );
  }

  const sorted = useMemo(
    () => [...sectors].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)),
    [sectors]
  );

  // The "CPU die" is the biggest mover.
  const hero = sorted[0];
  const pins = sorted.slice(1);

  // Split pins into left and right columns for the IC package layout.
  const leftPins = pins.filter((_, i) => i % 2 === 0);
  const rightPins = pins.filter((_, i) => i % 2 === 1);

  return (
    <div className="relative">
      {/* PCB substrate background pattern */}
      <div className="absolute inset-0 overflow-hidden rounded-lg opacity-[0.04]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="pcb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.8" fill="currentColor" />
            </pattern>
            <pattern id="pcb-traces" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 20h40M20 0v40" stroke="currentColor" strokeWidth="0.5" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pcb-grid)" />
          <rect width="100%" height="100%" fill="url(#pcb-traces)" />
        </svg>
      </div>

      {/* IC package layout */}
      <div className="relative flex items-stretch gap-2 xs:gap-3">
        {/* Left pins */}
        <div className="flex flex-1 flex-col gap-2">
          {leftPins.map((s) => (
            <Pin key={s.code} sector={s} side="left" />
          ))}
        </div>

        {/* Center: CPU die */}
        <div className="flex w-[120px] shrink-0 flex-col items-center justify-center xs:w-[140px] sm:w-[160px]">
          <CpuDie sector={hero} />
        </div>

        {/* Right pins */}
        <div className="flex flex-1 flex-col gap-2">
          {rightPins.map((s) => (
            <Pin key={s.code} sector={s} side="right" />
          ))}
        </div>
      </div>
    </div>
  );
}

function colorForChange(pct: number): string {
  if (pct >= 0) return "var(--up)";
  return "var(--down)";
}

function bgForChange(pct: number): string {
  const up = pct >= 0;
  const intensity = Math.min(Math.abs(pct) / 3, 1);
  const alpha = Math.round(intensity * 50) + 8;
  return up
    ? `color-mix(in oklab, var(--up) ${alpha}%, transparent)`
    : `color-mix(in oklab, var(--down) ${alpha}%, transparent)`;
}

/** The central "CPU die" — the biggest mover. */
function CpuDie({ sector }: { sector: Sector }) {
  const up = sector.changePct >= 0;
  const color = colorForChange(sector.changePct);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      {/* Outer chip border — gold traces */}
      <div
        className="relative flex w-full flex-col items-center justify-center rounded-md border-2 p-3 xs:p-4"
        style={{
          borderColor: color,
          background: bgForChange(sector.changePct),
          boxShadow: `0 0 20px ${up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"},
                      inset 0 0 20px ${up ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)"}`,
        }}
      >
        {/* Corner notch (IC orientation mark) */}
        <div
          className="absolute left-1 top-1 h-2 w-2 rounded-full opacity-40"
          style={{ background: color }}
        />

        {/* Inner die label */}
        <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-[color:var(--muted)]">
          Top Mover
        </div>
        <div className="mt-1 text-center font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--text)] xs:text-xs">
          {sector.name}
        </div>
        <div className="mt-0.5 font-mono text-[10px] tracking-wider text-[color:var(--muted)]">
          {sector.code}
        </div>
        <div
          className="mt-2 font-bebas text-3xl leading-none tracking-wide xs:text-4xl"
          style={{ color }}
        >
          {up ? "+" : ""}
          {sector.changePct.toFixed(2)}%
        </div>

        {/* Pin notches on edges — decorative */}
        <PinNotches />
      </div>
    </div>
  );
}

/** Decorative pin notches along the CPU die edges. */
function PinNotches() {
  return (
    <>
      {/* Top/bottom edge notches */}
      {[...Array(3)].map((_, i) => (
        <span
          key={`t${i}`}
          className="absolute top-0 h-1 w-3 -translate-y-px rounded-b-sm bg-[color:var(--border)]"
          style={{ left: `${25 + i * 25}%` }}
        />
      ))}
      {[...Array(3)].map((_, i) => (
        <span
          key={`b${i}`}
          className="absolute bottom-0 h-1 w-3 translate-y-px rounded-t-sm bg-[color:var(--border)]"
          style={{ left: `${25 + i * 25}%` }}
        />
      ))}
    </>
  );
}

/** A sector "pin" — like a chip leg connected to the die. */
function Pin({ sector, side }: { sector: Sector; side: "left" | "right" }) {
  const up = sector.changePct >= 0;
  const color = colorForChange(sector.changePct);

  return (
    <div
      className="group relative flex min-w-0 items-center gap-1.5 xs:gap-2"
      title={`${sector.name}: ${up ? "+" : ""}${sector.changePct.toFixed(2)}%`}
    >
      {/* Trace line connecting to center */}
      {side === "left" && (
        <div className="flex flex-1 items-center justify-end">
          <div className="flex min-w-0 flex-col items-end">
            <div className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--text)] xs:text-[10px]">
              {sector.code}
            </div>
            <div
              className="font-mono text-[10px] font-semibold xs:text-[11px]"
              style={{ color }}
            >
              {up ? "+" : ""}
              {sector.changePct.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* The "pin" pad + trace */}
      <div className="flex items-center" style={{ flexDirection: side === "left" ? "row" : "row-reverse" }}>
        {/* Trace */}
        <div
          className="h-[2px] w-3 xs:w-4"
          style={{ background: color, opacity: 0.5 }}
        />
        {/* Solder pad */}
        <div
          className="h-4 w-4 shrink-0 rounded-sm border xs:h-5 xs:w-5"
          style={{
            borderColor: color,
            background: bgForChange(sector.changePct),
            boxShadow: `0 0 6px ${up ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}
        />
      </div>

      {side === "right" && (
        <div className="flex flex-1 items-center">
          <div className="flex min-w-0 flex-col">
            <div className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--text)] xs:text-[10px]">
              {sector.code}
            </div>
            <div
              className="font-mono text-[10px] font-semibold xs:text-[11px]"
              style={{ color }}
            >
              {up ? "+" : ""}
              {sector.changePct.toFixed(2)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
