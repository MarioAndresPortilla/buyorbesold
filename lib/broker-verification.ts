/**
 * Broker Verification — Core logic for linking brokerage accounts and
 * verifying trade authenticity on the BuyOrBeSold social trading platform.
 *
 * Supported brokers:
 *   - Alpaca (paper + live) — OAuth 2.0
 *   - IBKR, Coinbase, Robinhood — planned (stubs only)
 *
 * IMPORTANT: This is not financial advice. Trade verification is provided
 * for transparency purposes only.
 */

import { createHash } from "crypto";
import { query, first } from "@/lib/db";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AlpacaTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: string;
  filled_qty: string;
  filled_avg_price: string;
  type: string;
  status: string;
  submitted_at: string;
  filled_at: string | null;
  asset_class: string;
}

export interface ProofHashInput {
  symbol: string;
  side: string;
  qty: string | number;
  price: string | number;
  filledAt: string;
  orderId: string;
}

// ─────────────────────────────────────────────
// Environment helpers
// ─────────────────────────────────────────────

function getAlpacaConfig() {
  const clientId = process.env.ALPACA_CLIENT_ID;
  const clientSecret = process.env.ALPACA_CLIENT_SECRET;
  const redirectUri = process.env.ALPACA_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Alpaca OAuth not configured — set ALPACA_CLIENT_ID, ALPACA_CLIENT_SECRET, ALPACA_REDIRECT_URI"
    );
  }

  return { clientId, clientSecret, redirectUri };
}

// ─────────────────────────────────────────────
// Trade hash verification
// ─────────────────────────────────────────────

/**
 * Compute a SHA-256 proof hash of canonical trade data.
 * Deterministic: same inputs always produce the same hash.
 */
export function computeProofHash(order: ProofHashInput): string {
  const canonical = [
    order.symbol.toUpperCase(),
    order.side.toLowerCase(),
    String(order.qty),
    String(order.price),
    order.filledAt,
    order.orderId,
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}

// ─────────────────────────────────────────────
// Alpaca OAuth flow
// ─────────────────────────────────────────────

/**
 * Build the Alpaca OAuth authorize URL. The caller should redirect the
 * user's browser here.
 */
export function getAlpacaAuthUrl(state: string): string {
  const { clientId, redirectUri } = getAlpacaConfig();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "account:write trading",
  });

  return `https://app.alpaca.markets/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeAlpacaCode(
  code: string
): Promise<AlpacaTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getAlpacaConfig();

  const res = await fetch("https://api.alpaca.markets/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<AlpacaTokenResponse>;
}

// ─────────────────────────────────────────────
// Account type detection (paper vs live)
// ─────────────────────────────────────────────

/**
 * Alpaca OAuth tokens are scoped to a single account type — a token issued
 * for a paper account returns 401/403 against the live API and vice versa.
 * To support both transparently, we probe the account endpoint on each API
 * and use whichever one accepts the token.
 */
export type AlpacaAccountType = "paper" | "live";

const ALPACA_API_URLS: Record<AlpacaAccountType, string> = {
  paper: "https://paper-api.alpaca.markets",
  live: "https://api.alpaca.markets",
};

/**
 * Probe both Alpaca APIs and return whichever one accepts the access token.
 * Tries paper first (safer default for testing). Returns null if neither works.
 */
export async function detectAlpacaAccountType(
  accessToken: string
): Promise<AlpacaAccountType | null> {
  for (const type of ["paper", "live"] as const) {
    try {
      const res = await fetch(`${ALPACA_API_URLS[type]}/v2/account`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return type;
    } catch {
      // Network error — try the other one
    }
  }
  return null;
}

/**
 * Fetch closed (filled) orders from the appropriate Alpaca API.
 * Pass `type` to hit a specific environment, or omit to auto-detect.
 */
export async function fetchAlpacaOrders(
  accessToken: string,
  options: { type?: AlpacaAccountType; since?: string } = {}
): Promise<AlpacaOrder[]> {
  const type = options.type ?? (await detectAlpacaAccountType(accessToken));
  if (!type) {
    throw new Error("Alpaca token rejected by both paper and live APIs");
  }

  const params = new URLSearchParams({
    status: "closed",
    limit: "500",
    direction: "desc",
  });

  if (options.since) {
    params.set("after", options.since);
  }

  const res = await fetch(
    `${ALPACA_API_URLS[type]}/v2/orders?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca orders fetch failed (${res.status}, ${type}): ${text}`);
  }

  const orders = (await res.json()) as AlpacaOrder[];

  // Only return filled orders that have price data
  return orders.filter(
    (o) => o.status === "filled" && o.filled_at && o.filled_avg_price
  );
}

// ─────────────────────────────────────────────
// Import Alpaca trades into social_trades
// ─────────────────────────────────────────────

/**
 * Import filled Alpaca orders as verified social trades.
 *
 * Auto-detects whether the access token is for a paper or live account,
 * then imports from the matching API. The broker_source is tagged
 * "alpaca-paper" or "alpaca-live" so re-syncs hit the right endpoint.
 *
 * - Skips orders that already exist (by broker_order_id)
 * - Sets verification = 'broker-linked'
 * - Computes and stores proof_hash
 * - Updates the trader's verification level
 *
 * Returns the count of newly imported trades plus the detected account type.
 */
export async function importAlpacaTrades(
  traderId: string,
  accessToken: string
): Promise<{ imported: number; skipped: number; accountType: AlpacaAccountType }> {
  const accountType = await detectAlpacaAccountType(accessToken);
  if (!accountType) {
    throw new Error("Alpaca token rejected by both paper and live APIs");
  }

  const orders = await fetchAlpacaOrders(accessToken, { type: accountType });

  let imported = 0;
  let skipped = 0;

  for (const order of orders) {
    // Check if this order was already imported
    const existing = first(
      await query<{ id: string }>`
        SELECT id FROM social_trades
        WHERE broker_order_id = ${order.id}
          AND trader_id = ${traderId}
      `
    );

    if (existing) {
      skipped++;
      continue;
    }

    const proofHash = computeProofHash({
      symbol: order.symbol,
      side: order.side,
      qty: order.filled_qty,
      price: order.filled_avg_price,
      filledAt: order.filled_at!,
      orderId: order.id,
    });

    // Map Alpaca side to our trade side: buy = long, sell = short
    const side = order.side === "buy" ? "long" : "short";

    // Map Alpaca asset_class to our asset_class
    const assetClass =
      order.asset_class === "crypto" ? "crypto" : "stocks";

    await query`
      INSERT INTO social_trades (
        trader_id, symbol, asset_class, side, strategy,
        size, size_unit, entry_price, entry_date,
        verification, broker_order_id, proof_hash,
        tags
      ) VALUES (
        ${traderId},
        ${order.symbol.toUpperCase()},
        ${assetClass},
        ${side},
        ${"daytrade"},
        ${parseFloat(order.filled_qty)},
        ${"shares"},
        ${parseFloat(order.filled_avg_price)},
        ${order.filled_at},
        ${"broker-linked"},
        ${order.id},
        ${proofHash},
        ${[]}
      )
    `;

    imported++;
  }

  // Upgrade trader verification level if not already higher.
  // Tag broker_source with the account type so re-syncs know which API to hit.
  await upgradeTraderVerification(traderId, "broker-linked", `alpaca-${accountType}`);

  return { imported, skipped, accountType };
}

// ─────────────────────────────────────────────
// Manual screenshot verification
// ─────────────────────────────────────────────

/**
 * Mark a trade as screenshot-verified. The image URL points to the
 * uploaded screenshot of the broker fill confirmation.
 *
 * Returns true if the trade was updated, false if not found or not owned.
 */
export async function submitScreenshotProof(
  traderId: string,
  tradeId: string,
  imageUrl: string
): Promise<boolean> {
  // Verify ownership
  const trade = first(
    await query<{ id: string; trader_id: string; verification: string }>`
      SELECT id, trader_id, verification FROM social_trades
      WHERE id = ${tradeId}
    `
  );

  if (!trade || trade.trader_id !== traderId) {
    return false;
  }

  // Don't downgrade verification (broker-linked > screenshot)
  if (
    trade.verification === "broker-linked" ||
    trade.verification === "exchange-api"
  ) {
    return false;
  }

  // Compute a proof hash from the image URL for audit trail
  const proofHash = createHash("sha256")
    .update(`screenshot|${tradeId}|${imageUrl}`)
    .digest("hex");

  await query`
    UPDATE social_trades
    SET verification = ${"screenshot"},
        proof_hash = ${proofHash},
        updated_at = NOW()
    WHERE id = ${tradeId}
      AND trader_id = ${traderId}
  `;

  // Upgrade trader if they're only self-reported
  await upgradeTraderVerification(traderId, "screenshot");

  return true;
}

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

/** Verification levels ranked from weakest to strongest. */
const VERIFICATION_RANK: Record<string, number> = {
  "self-reported": 0,
  screenshot: 1,
  "broker-linked": 2,
  "exchange-api": 3,
};

/**
 * Upgrade a trader's verification level, but never downgrade it.
 * Optionally sets the broker_source field.
 */
async function upgradeTraderVerification(
  traderId: string,
  newLevel: string,
  brokerSource?: string
): Promise<void> {
  const trader = first(
    await query<{ verification: string }>`
      SELECT verification FROM traders WHERE id = ${traderId}
    `
  );

  if (!trader) return;

  const currentRank = VERIFICATION_RANK[trader.verification] ?? 0;
  const newRank = VERIFICATION_RANK[newLevel] ?? 0;

  if (newRank <= currentRank) return;

  if (brokerSource) {
    await query`
      UPDATE traders
      SET verification = ${newLevel},
          broker_source = ${brokerSource},
          updated_at = NOW()
      WHERE id = ${traderId}
    `;
  } else {
    await query`
      UPDATE traders
      SET verification = ${newLevel},
          updated_at = NOW()
      WHERE id = ${traderId}
    `;
  }
}
