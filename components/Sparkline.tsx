"use client";

import { useEffect, useRef } from "react";

interface SparklineProps {
  data?: number[];
  up: boolean;
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
  width = 220,
  height = 56,
  stroke,
  fill,
  className,
}: SparklineProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const series =
      data && data.length > 1 ? data : fallbackWalk(up, 24);
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;

    const pad = 4;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;

    const pts = series.map((v, i) => {
      const x = pad + (i / (series.length - 1)) * innerW;
      const y = pad + innerH - ((v - min) / range) * innerH;
      return { x, y };
    });

    const strokeColor =
      stroke ?? (up ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)");
    const fillTop =
      fill ?? (up ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)");

    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, fillTop);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.moveTo(pts[0].x, height - pad);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, height - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }, [data, up, width, height, stroke, fill]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
