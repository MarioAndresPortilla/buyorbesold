import { query } from "./db";

export const MAX_WATCHLIST_SYMBOLS = 10;

export interface UserWatchlistRow {
  symbol: string;
  position: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listUserWatchlist(email: string): Promise<string[]> {
  const rows = await query<UserWatchlistRow>`
    SELECT symbol, position
    FROM user_watchlists
    WHERE user_email = ${normalizeEmail(email)}
    ORDER BY position ASC, id ASC
  `;
  return rows.map((r) => r.symbol);
}

export async function countUserWatchlist(email: string): Promise<number> {
  const rows = await query<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM user_watchlists
    WHERE user_email = ${normalizeEmail(email)}
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function addToUserWatchlist(
  email: string,
  symbol: string
): Promise<void> {
  const normEmail = normalizeEmail(email);
  const sym = symbol.trim().toUpperCase();
  await query`
    INSERT INTO user_watchlists (user_email, symbol, position)
    VALUES (
      ${normEmail},
      ${sym},
      COALESCE((SELECT MAX(position) + 1 FROM user_watchlists WHERE user_email = ${normEmail}), 0)
    )
    ON CONFLICT (user_email, symbol) DO NOTHING
  `;
}

export async function removeFromUserWatchlist(
  email: string,
  symbol: string
): Promise<void> {
  await query`
    DELETE FROM user_watchlists
    WHERE user_email = ${normalizeEmail(email)}
      AND symbol = ${symbol.trim().toUpperCase()}
  `;
}
