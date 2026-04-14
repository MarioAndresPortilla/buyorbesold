/**
 * Database connection wrapper for Vercel Postgres (Neon).
 *
 * Usage:
 *   import { query, first } from "@/lib/db";
 *   const rows = await query<Trader>`SELECT * FROM traders WHERE id = ${id}`;
 *   const one = first(rows);
 *
 * Env vars required:
 *   POSTGRES_URL          — connection string (pooled, for serverless)
 *   POSTGRES_URL_NON_POOLING — direct connection (for migrations)
 *
 * Falls back gracefully if not configured (returns empty results + logs warning).
 */

import { neon, neonConfig } from "@neondatabase/serverless";

// Enable fetch-based connection pooling for Vercel Edge/Serverless
neonConfig.fetchConnectionCache = true;

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "development") {
  console.warn(
    "[db] POSTGRES_URL not set — social trading features will be unavailable."
  );
}

const sqlFn = connectionString ? neon(connectionString) : null;

/**
 * Execute a parameterized SQL query. Returns an array of row objects.
 *
 * Uses a wrapper function instead of the raw tagged template to guarantee
 * the return type is always Record<string, unknown>[] (Neon's default
 * FullQueryResults type is a union that's awkward to work with).
 */
export async function query<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  if (!sqlFn) return [];
  const result = await sqlFn(strings, ...values);
  // neon() without fullResults returns Record<string, unknown>[]
  return result as unknown as T[];
}

/**
 * Check if the database is configured and reachable.
 */
export async function dbHealthCheck(): Promise<boolean> {
  if (!sqlFn) return false;
  try {
    await query`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: extract the first row or null.
 */
export function first<T>(rows: T[]): T | null {
  return rows.length > 0 ? rows[0] : null;
}

// Neon returns Postgres NUMERIC columns as strings. Callers that do arithmetic
// or .toFixed() need real numbers — coerce at the API boundary with these.

export function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function coerceNums<T extends Record<string, unknown>>(
  row: T,
  fields: readonly string[],
): T {
  const out: Record<string, unknown> = { ...row };
  for (const f of fields) {
    if (f in out) out[f] = toNum(out[f]);
  }
  return out as T;
}

export const STATS_NUMERIC_FIELDS = [
  "win_rate",
  "win_rate_wilson",
  "total_pnl_pct",
  "avg_win_pct",
  "avg_loss_pct",
  "profit_factor",
  "expectancy",
  "avg_r_multiple",
  "sharpe",
  "sortino",
  "max_drawdown_pct",
  "best_trade_pnl_pct",
  "worst_trade_pnl_pct",
] as const;

export const TRADE_NUMERIC_FIELDS = [
  "size",
  "entry_price",
  "exit_price",
  "stop_price",
  "target_price",
  "pnl_pct",
] as const;
