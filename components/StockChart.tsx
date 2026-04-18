"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartRange, ChartResponse } from "@/lib/chart";
import { CHART_RANGES } from "@/lib/chart";
import { arrow, formatPct, formatPrice } from "@/lib/format";

interface Props {
  symbol: string;
  initial: ChartResponse;
}

const RANGES: ChartRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y"];

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export default function StockChart({ symbol, initial }: Props) {
  const [range, setRange] = useState<ChartRange>(initial.range);
  const [data, setData] = useState<ChartResponse>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // One-time chart setup. Colors are pulled from CSS vars so the chart
  // follows the site theme toggle without us threading theme state.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const text = cssVar("--text", "#e5e7eb");
    const muted = cssVar("--muted", "#9ca3af");
    const border = cssVar("--border", "rgba(255,255,255,0.08)");

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: muted,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      rightPriceScale: { borderColor: border },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Silence unused-text-color lint: the option is accepted by the lib
    // even when individual series override it.
    void text;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Push data into the chart whenever it arrives or timeframe changes.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    candleSeries.setData(
      data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volumeSeries.setData(
      data.volumes.map((v) => ({
        time: v.time as UTCTimestamp,
        value: v.value,
        color: v.color,
      })) as { time: Time; value: number; color: string }[]
    );
    chart.timeScale().fitContent();
  }, [data]);

  const switchRange = useCallback(
    async (next: ChartRange) => {
      if (next === range && !error) return;
      setRange(next);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/chart/${encodeURIComponent(symbol)}?range=${next}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ChartResponse;
        setData(body);
      } catch {
        setError("Couldn't load that range.");
      } finally {
        setLoading(false);
      }
    },
    [symbol, range, error]
  );

  const price = data.regularMarketPrice;
  const change = data.changePct;
  const up = typeof change === "number" && change >= 0;

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-bebas text-3xl tracking-wide text-[color:var(--text)] sm:text-4xl">
              {data.symbol}
            </h1>
            {data.name && (
              <span className="truncate font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                {data.name}
              </span>
            )}
            {data.exchange && (
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
                {data.exchange}
              </span>
            )}
          </div>
          {typeof price === "number" && (
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono text-xl font-semibold text-[color:var(--text)]">
                {formatPrice(price)}
              </span>
              {typeof change === "number" && (
                <span
                  className="font-mono text-sm font-semibold"
                  style={{ color: up ? "var(--up)" : "var(--down)" }}
                >
                  {arrow(change)} {formatPct(change)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => {
            const active = r === range;
            return (
              <button
                key={r}
                type="button"
                onClick={() => switchRange(r)}
                disabled={loading && active}
                aria-pressed={active}
                className={
                  "rounded-md border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors " +
                  (active
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-black"
                    : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--text)]")
                }
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={containerRef}
        className="h-[440px] w-full sm:h-[520px]"
        aria-label={`${data.symbol} price chart, ${CHART_RANGES[range].range} at ${CHART_RANGES[range].interval}`}
      />

      {error && (
        <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </div>
      )}

      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
        Not financial advice. Data: Yahoo Finance · interval{" "}
        {CHART_RANGES[range].interval} · range {CHART_RANGES[range].range}
      </p>
    </section>
  );
}
