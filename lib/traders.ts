/**
 * Trader profile helpers — lookup, creation, username validation.
 *
 * These functions are the single source of truth for the relationship
 * between an authenticated email and a Trader row in the database.
 */

import { query, first } from "./db";

export interface TraderRecord {
  id: string;
  username: string;
  display_name: string;
  email: string;
  verification: string;
  created_at: string;
}

/**
 * Fetch a trader by email. Returns null if no profile exists yet.
 * This is the main check for "does this logged-in user have a profile?"
 */
export async function getTraderByEmail(email: string): Promise<TraderRecord | null> {
  const row = first(
    await query<TraderRecord>`
      SELECT id, username, display_name, email, verification, created_at
      FROM traders WHERE email = ${email.toLowerCase()}
    `
  );
  return row;
}

/**
 * Fetch a trader by username. Returns null if not found.
 */
export async function getTraderByUsername(username: string): Promise<TraderRecord | null> {
  const row = first(
    await query<TraderRecord>`
      SELECT id, username, display_name, email, verification, created_at
      FROM traders WHERE username = ${username.toLowerCase()}
    `
  );
  return row;
}

/**
 * Reserved usernames that can't be claimed — matches app routes and
 * common brand terms. Keep lowercase.
 */
const RESERVED = new Set([
  "admin", "api", "auth", "login", "logout", "signup", "register",
  "settings", "support", "help", "about", "terms", "privacy", "legal",
  "dashboard", "scanner", "journal", "briefings", "briefing", "rankings",
  "ranking", "feed", "trader", "traders", "my-journal", "newsletter",
  "buyorbesold", "bob", "bobs", "mario", "team", "staff", "system",
  "www", "mail", "root", "null", "undefined", "anonymous", "guest",
  "new", "edit", "delete", "create", "update",
]);

export type UsernameValidationError =
  | "too-short"
  | "too-long"
  | "invalid-chars"
  | "reserved"
  | "taken";

/**
 * Validate a username format. Returns null if valid, or an error code.
 * Does NOT check for uniqueness — that requires a DB round-trip.
 */
export function validateUsernameFormat(
  username: string
): UsernameValidationError | null {
  const u = username.toLowerCase().trim();
  if (u.length < 3) return "too-short";
  if (u.length > 20) return "too-long";
  if (!/^[a-z0-9_-]+$/.test(u)) return "invalid-chars";
  if (RESERVED.has(u)) return "reserved";
  return null;
}

/**
 * Check if a username is available. Runs format validation AND
 * a uniqueness check against the DB.
 */
export async function isUsernameAvailable(
  username: string
): Promise<{ ok: true } | { ok: false; reason: UsernameValidationError }> {
  const formatError = validateUsernameFormat(username);
  if (formatError) return { ok: false, reason: formatError };

  const existing = await getTraderByUsername(username);
  if (existing) return { ok: false, reason: "taken" };

  return { ok: true };
}

/**
 * Create a new trader profile for a newly-registered user.
 * Assumes username is already validated + available. Returns the new row.
 */
export async function createTrader(params: {
  email: string;
  username: string;
  displayName: string;
}): Promise<TraderRecord> {
  const { email, username, displayName } = params;

  const rows = await query<TraderRecord>`
    INSERT INTO traders (email, username, display_name, email_verified, verification)
    VALUES (
      ${email.toLowerCase()},
      ${username.toLowerCase()},
      ${displayName.slice(0, 50)},
      true,
      'self-reported'
    )
    RETURNING id, username, display_name, email, verification, created_at
  `;

  if (rows.length === 0) {
    throw new Error("Failed to create trader");
  }

  return rows[0];
}

/**
 * Suggest a username based on the email local-part. The user can accept
 * or override this on the onboarding screen.
 */
export function suggestUsername(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 20);
  return cleaned.length >= 3 ? cleaned : `trader${Math.floor(Math.random() * 10000)}`;
}
