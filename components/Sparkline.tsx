"use client";

import { useEffect, useRef, useState } from "react";

interface SparklineProps {
  data?: number[];
  up: boolean;
  /** Fallback width if the container has no measurable width yet. */
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}

function fallbackWalk(up: boolean, points: number): number[] {
  const out: number[] = [];
  let v = 50;
  for (let i = 0; i < points; i++) {
    const drift = up ? 0.4 : -0.4;
    const noise = (Math.random() - 0.5) * 4;
    v = Math.max(5, Math.min(95, v + drift + noise));
    out.push(v);
  }
  return out;
}

export default function Sparkline({
  data,
  up,
  width: fallbackWidth = 220,
  height = 52,
  stroke,
  fill,
  className,
}: SparklineProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(fallbackWidth);

  // Observe container width so the sparkline redraws cleanly on mobile rotation,
  // theme changes that alter padding, etc. Falls back to `fallbackWidth` if no RO.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (typeof ResizeObserver === "undefined") {
      setMeasuredWidth(wrap.clientWidth || fallbackWidth);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) setMeasuredWidth(w);
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [fallbackWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = Math.max(40, measuredWidth);
    const h = height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const series = data && data.length > 1 ? data : fallbackWalk(up, 24);
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;

    const pad = 4;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    const pts = series.map((v, i) => {
      const x = pad + (i / (series.length - 1)) * innerW;
      const y = pad + innerH - ((v - min) / range) * innerH;
      return { x, y };
    });

    const strokeColor =
      stroke ?? (up ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)");
    const fillTop =
      fill ?? (up ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)");

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, fillTop);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h - pad);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }, [data, up, measuredWidth, height, stroke, fill]);

  return (
    <div ref={wrapRef} className={className ?? "w-full"} style={{ height }}>
      <canvas ref={canvasRef} aria-hidden />
    </div>
  );
}
