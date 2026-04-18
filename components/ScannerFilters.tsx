"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Filters {
  priceMin: number;
  priceMax: number;
  maxFloat: number; // in millions for UI, converted to raw for URL
  minRvol: number;
  smaBouncePct: number; // as %, converted to decimal for URL
}

const DEFAULTS: Filters = {
  priceMin: 1,
  priceMax: 20,
  maxFloat: 20,
  minRvol: 1.5,
  smaBouncePct: 2,
};

const LS_KEY = "bobs-scanner-filters";

function loadSaved(): Partial<Filters> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persist(filters: Filters) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(filters));
  } catch {
    // ignore
  }
}

export default function ScannerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULTS);

  // On mount: load from URL params → localStorage → defaults
  useEffect(() => {
    const saved = loadSaved();
    const fromUrl: Partial<Filters> = {};
    const pm = searchParams.get("priceMin");
    const px = searchParams.get("priceMax");
    const mf = searchParams.get("maxFloat");
    const mr = searchParams.get("minRvol");
    const sb = searchParams.get("smaBouncePct");
    if (pm) fromUrl.priceMin = Number(pm);
    if (px) fromUrl.priceMax = Number(px);
    if (mf) fromUrl.maxFloat = Number(mf) / 1_000_000; // raw → millions
    if (mr) fromUrl.minRvol = Number(mr);
    if (sb) fromUrl.smaBouncePct = Number(sb) * 100; // decimal → %

    const merged: Filters = { ...DEFAULTS, ...saved, ...fromUrl };
    // Mirror the server's parseCriteria auto-scaling so the form shows the
    // float cap the scanner is actually using. Only apply when `maxFloat`
    // wasn't explicit in the URL (i.e. the server did the same inference).
    if (!mf && merged.priceMax > 30 && merged.maxFloat === DEFAULTS.maxFloat) {
      merged.maxFloat = 500;
    }
    setFilters(merged);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = useCallback(() => {
    persist(filters);
    const params = new URLSearchParams();
    if (filters.priceMin !== DEFAULTS.priceMin) params.set("priceMin", String(filters.priceMin));
    if (filters.priceMax !== DEFAULTS.priceMax) params.set("priceMax", String(filters.priceMax));
    if (filters.maxFloat !== DEFAULTS.maxFloat) params.set("maxFloat", String(filters.maxFloat * 1_000_000));
    if (filters.minRvol !== DEFAULTS.minRvol) params.set("minRvol", String(filters.minRvol));
    if (filters.smaBouncePct !== DEFAULTS.smaBouncePct) params.set("smaBouncePct", String(filters.smaBouncePct / 100));
    const qs = params.toString();
    router.push(qs ? `/scanner?${qs}` : "/scanner");
    router.refresh();
    setOpen(false);
  }, [filters, router]);

  const reset = useCallback(() => {
    setFilters(DEFAULTS);
    persist(DEFAULTS);
    router.push("/scanner");
    router.refresh();
    setOpen(false);
  }, [router]);

  const isCustom =
    filters.priceMin !== DEFAULTS.priceMin ||
    filters.priceMax !== DEFAULTS.priceMax ||
    filters.maxFloat !== DEFAULTS.maxFloat ||
    filters.minRvol !== DEFAULTS.minRvol ||
    filters.smaBouncePct !== DEFAULTS.smaBouncePct;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
          isCustom
            ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
            : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
        }`}
      >
        {isCustom ? "⚡ Custom filter active" : "⚙ Customize filter"}
      </button>
    );
  }

  const inputCls =
    "w-full rounded-md border border-[color:var(--border)] bg-black/20 px-2.5 py-2 font-mono text-xs text-[color:var(--text)] focus:border-[color:var(--accent)] focus:outline-none";

  return (
    <div className="rounded-xl border border-[color:var(--accent)]/40 bg-[color:var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bebas text-xl tracking-wide">Custom scanner filter</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)] hover:text-[color:var(--accent)]"
        >
          ✕ Close
        </button>
      </div>

      <div className="grid gap-4 xs:grid-cols-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Min price ($)
          </span>
          <input
            type="number"
            step="0.5"
            min="0.01"
            max="500"
            value={filters.priceMin}
            onChange={(e) => setFilters((f) => ({ ...f, priceMin: Number(e.target.value) || 0.01 }))}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Max price ($)
          </span>
          <input
            type="number"
            step="1"
            min="0.10"
            max="1000"
            value={filters.priceMax}
            onChange={(e) => {
              const next = Number(e.target.value) || 1;
              setFilters((f) => ({
                ...f,
                priceMax: next,
                // The default float cap (20M) is built for small-caps; at
                // higher prices that filter silently kills every result.
                // Auto-widen it when the user hasn't touched float yet.
                maxFloat:
                  next > 30 && f.maxFloat === DEFAULTS.maxFloat
                    ? 500
                    : f.maxFloat,
              }));
            }}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Max float (M shares)
          </span>
          <input
            type="number"
            step="1"
            min="1"
            max="500"
            value={filters.maxFloat}
            onChange={(e) => setFilters((f) => ({ ...f, maxFloat: Number(e.target.value) || 1 }))}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Min RVOL (x)
          </span>
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="10"
            value={filters.minRvol}
            onChange={(e) => setFilters((f) => ({ ...f, minRvol: Number(e.target.value) || 0.5 }))}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            SMA bounce (%)
          </span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="10"
            value={filters.smaBouncePct}
            onChange={(e) => setFilters((f) => ({ ...f, smaBouncePct: Number(e.target.value) || 0.5 }))}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={apply}
          className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90"
        >
          Apply filter
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)] hover:text-[color:var(--accent)]"
          >
            Reset to defaults
          </button>
        )}
      </div>

      <p className="mt-3 font-mono text-[9px] italic text-[color:var(--muted)]">
        Your filter is saved to this browser. Log in to sync across devices (coming soon).
      </p>
    </div>
  );
}
