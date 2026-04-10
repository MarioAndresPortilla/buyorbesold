"use client";

import { useMemo } from "react";
import type { Sector } from "@/lib/types";

const DEFAULT_SECTORS: Sector[] = [
  { code: "TECH", name: "Technology", changePct: 1.2 },
  { code: "ENERGY", name: "Energy", changePct: -0.8 },
  { code: "FINANCE", name: "Financials", changePct: 0.6 },
  { code: "HEALTH", name: "Healthcare", changePct: -0.3 },
  { code: "CONSUM", name: "Consumer", changePct: 0.4 },
  { code: "INDUST", name: "Industrials", changePct: 0.9 },
  { code: "UTIL", name: "Utilities", changePct: -0.2 },
  { code: "REIT", name: "Real Estate", changePct: -1.1 },
  { code: "MATS", name: "Materials", changePct: 1.5 },
  { code: "CRYPTO", name: "Crypto", changePct: 2.3 },
];

interface SectorHeatmapProps {
  sectors?: Sector[];
  jitter?: boolean;
}

export default function SectorHeatmap({ sectors, jitter = false }: SectorHeatmapProps) {
  const list = useMemo(() => {
    const base = sectors && sectors.length ? sectors : DEFAULT_SECTORS;
    if (!jitter) return base;
    // Add a small deterministic-ish nudge so the grid looks alive between refreshes.
    return base.map((s) => ({
      ...s,
      changePct: s.changePct + (Math.random() - 0.5) * 0.4,
    }));
  }, [sectors, jitter]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {list.map((s) => {
        const up = s.changePct >= 0;
        const intensity = Math.min(Math.abs(s.changePct) / 3, 1);
        const bg = up
          ? `color-mix(in oklab, var(--up) ${Math.round(intensity * 55) + 8}%, transparent)`
          : `color-mix(in oklab, var(--down) ${Math.round(intensity * 55) + 8}%, transparent)`;
        return (
          <div
            key={s.code}
            className="flex flex-col justify-between rounded-lg border border-[color:var(--border)] p-3"
            style={{ background: bg }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
              {s.code}
            </div>
            <div
              className="mt-2 font-mono text-lg font-bold"
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
