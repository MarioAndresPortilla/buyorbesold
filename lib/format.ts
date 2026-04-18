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

/**
 * Header timestamp for a published brief. When a full `publishedAt` exists
 * we render "Apr 10, 2026 · 8:00 AM ET · Premarket"; otherwise just
 * "Apr 10, 2026". All rendering is pinned to America/New_York so readers —
 * and Mario — see the same wall-clock time regardless of viewer locale.
 */
export function formatBriefDate(
  brief: { date: string; publishedAt?: string }
): string {
  const iso = brief.publishedAt;
  if (!iso) return formatBriefDay(brief.date);
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return formatBriefDay(brief.date);
    const day = d.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    });
    const period = getBriefPeriod(d);
    return `${day} · ${time} ET · ${period}`;
  } catch {
    return formatBriefDay(brief.date);
  }
}

/**
 * Part of the trading day a timestamp falls into. Aligns with the AI brief
 * editions (premarket / midday / postmarket) plus explicit "Open" and
 * "Power Hour" buckets readers recognize from the tape. All thresholds are
 * evaluated in America/New_York so DST shifts don't flip the label.
 *
 *   04:00–09:30  Premarket
 *   09:30–12:00  Open
 *   12:00–14:00  Midday
 *   14:00–16:00  Power Hour
 *   16:00–20:00  Postmarket
 *   else         Overnight
 */
export function getBriefPeriod(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "";
  // Derive the ET hour/minute by formatting in that zone (avoids shipping
  // a full tz database or depending on Intl segment shapes).
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minutePart = parts.find((p) => p.type === "minute")?.value ?? "00";
  const hour = Number(hourPart) % 24; // "24" → 0 on some locales
  const minute = Number(minutePart);
  const mins = hour * 60 + minute;

  if (mins >= 240 && mins < 570) return "Premarket";   // 04:00–09:30
  if (mins >= 570 && mins < 720) return "Open";        // 09:30–12:00
  if (mins >= 720 && mins < 840) return "Midday";      // 12:00–14:00
  if (mins >= 840 && mins < 960) return "Power Hour";  // 14:00–16:00
  if (mins >= 960 && mins < 1200) return "Postmarket"; // 16:00–20:00
  return "Overnight";
}

/** "Apr 10, 2026" from a YYYY-MM-DD string, avoiding TZ-off-by-one. */
function formatBriefDay(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(yyyyMmDd)) return yyyyMmDd;
  const [y, m, d] = yyyyMmDd.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
