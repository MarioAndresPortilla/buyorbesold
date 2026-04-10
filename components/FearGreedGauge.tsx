"use client";

import { useEffect, useRef } from "react";

interface FearGreedGaugeProps {
  score: number;
  label: string;
  size?: number;
  compact?: boolean;
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
  size = 260,
  compact = false,
}: FearGreedGaugeProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const height = Math.round(size * 0.6);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, height);

    const cx = size / 2;
    const cy = height - 12;
    const radius = Math.min(size, height * 2) / 2 - 20;
    const stroke = 10;

    // Draw arc segments
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

    // Needle
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

    // Hub
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [score, size, height]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={ref} aria-label={`Fear & Greed Index: ${score} (${label})`} />
      <div className="flex flex-col items-center">
        <div className="font-bebas text-5xl leading-none tracking-wider text-[color:var(--text)]">
          {score}
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {label}
        </div>
      </div>
      {!compact && (
        <div className="mt-2 flex w-full items-center justify-between font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
          {SEGMENTS.map((s) => (
            <div key={s.title} className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              <span className="hidden sm:inline">{s.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
