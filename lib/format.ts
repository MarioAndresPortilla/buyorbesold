export function formatPrice(value: number, opts: { decimals?: number; currency?: boolean } = {}): string {
  const { decimals, currency = true } = opts;
  if (!Number.isFinite(value)) return "—";
  const d = decimals ?? (Math.abs(value) >= 1000 ? 2 : value >= 100 ? 2 : value >= 1 ? 2 : 4);
  const str = value.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  return currency ? `$${str}` : str;
}

export function formatChange(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(decimals)}`;
}

export function formatPct(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toString();
}

export function arrow(delta: number): "▲" | "▼" | "▬" {
  if (delta > 0) return "▲";
  if (delta < 0) return "▼";
  return "▬";
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
