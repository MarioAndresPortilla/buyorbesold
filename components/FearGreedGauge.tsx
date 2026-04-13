"use client";

import { useEffect, useRef, useState } from "react";

interface FearGreedGaugeProps {
  score: number;
  label: string;
  /** Max rendered width in px. Gauge shrinks to fit narrower containers. */
  maxSize?: number;
  compact?: boolean;
  /** True when the score is a fallback due to API failure. */
  stale?: boolean;
}

const SEGMENTS: Array<{ start: number; end: number; color: string; title: string }> = [
  { start: 0, end: 25, color: "#ef4444", title: "Extreme Fear" },
  { start: 25, end: 45, color: "#f97316", title: "Fear" },
  { start: 45, end: 55, color: "#eab308", title: "Neutral" },
  { start: 55, end: 75, color: "#84cc16", title: "Greed" },
  { start: 75, end: 100, color: "#22c55e", title: "Extreme Greed" },
];

export default function FearGreedGauge({
  score,
  label,
  maxSize = 260,
  compact = false,
  stale = false,
}: FearGreedGaugeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<number>(Math.min(maxSize, 220));

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => {
      const w = wrap.clientWidth;
      if (w > 0) setSize(Math.max(160, Math.min(maxSize, w)));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [maxSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = size;
    const h = Math.round(w * 0.6);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h - 12;
    const radius = Math.min(w, h * 2) / 2 - 20;
    const stroke = Math.max(8, Math.round(w * 0.04));

    SEGMENTS.forEach((seg) => {
      const startAngle = Math.PI + (seg.start / 100) * Math.PI;
      const endAngle = Math.PI + (seg.end / 100) * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = stroke;
      ctx.lineCap = "butt";
      ctx.stroke();
    });

    const clamped = Math.max(0, Math.min(100, score));
    const needleAngle = Math.PI + (clamped / 100) * Math.PI;
    const needleLen = radius - 6;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [score, size]);

  return (
    <div
      ref={wrapRef}
      className="flex w-full max-w-[260px] flex-col items-center gap-2"
    >
      <canvas
        ref={canvasRef}
        aria-label={`Fear & Greed Index: ${score} (${label})`}
      />
      <div className="flex flex-col items-center">
        <div className={`font-bebas text-5xl leading-none tracking-wider ${stale ? "text-[color:var(--muted)] opacity-50" : "text-[color:var(--text)]"}`}>
          {score}
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {label}
        </div>
        {stale && (
          <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-amber-400/80">
            API unavailable — showing fallback
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-2 flex w-full items-center justify-between gap-1 font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
          {SEGMENTS.map((s) => (
            <div key={s.title} className="flex items-center gap-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              <span className="hidden md:inline">{s.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
