/**
 * Tool-use definitions for the journal chatbot.
 *
 * The user's own trades are blanket-injected into the system prompt (see
 * ai-chat.ts). Congress trades, leaderboards, and live market snapshots
 * are expensive and only occasionally needed — so we expose them as
 * Claude tools the model calls on demand.
 *
 * Design constraints:
 * - All tools are read-only.
 * - Results are trimmed to keep response payloads small (tokens).
 * - Any tool error surfaces as a short text message — never an exception.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getLeaderboard, getMemberProfile, queryCongressTrades } from "./congress-queries";
import type { CongressRankMetric } from "./congress-queries";
import type { CongressStatPeriod, CongressTradeType } from "./congress-types";
import { safeYahoo } from "./markets";

// ─────────────────────────────────────────────
// Tool schemas — Anthropic tool-use format
// ─────────────────────────────────────────────

export const CHAT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_congress_leaderboard",
    description:
      "Return the top-N members of Congress for a given period and ranking metric. " +
      "Use this when the user asks who's winning, who's on top, or for a ranked list. " +
      "Metrics: timing_alpha_30d (default), timing_alpha_90d, win_rate_30d, total_trades, est_volume_usd.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["1m", "3m", "ytd", "1y", "all"],
          description: "Time window. Default: 1y.",
        },
        metric: {
          type: "string",
          enum: ["timing_alpha_30d", "timing_alpha_90d", "win_rate_30d", "total_trades", "est_volume_usd"],
          description: "What to sort by. Default: timing_alpha_30d.",
        },
        limit: {
          type: "number",
          description: "Number of entries. 1-25. Default: 10.",
        },
      },
    },
  },
  {
    name: "get_congress_member",
    description:
      "Fetch the full profile for a single member: their stats across 1m/3m/ytd/1y/all periods, " +
      "top traded symbols, and their 20 most recent trades. Use the slug from the leaderboard " +
      "(e.g. 'nancy-pelosi').",
    input_schema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "URL-safe member id, e.g. 'nancy-pelosi'",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_congress_trades",
    description:
      "Query the raw Congress trade feed with optional filters. Use when the user asks " +
      "about activity in a specific stock, a specific member's trades, or recent disclosures.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock ticker (uppercase)" },
        member: { type: "string", description: "Member slug (e.g. 'nancy-pelosi')" },
        type: { type: "string", enum: ["buy", "sell", "exchange", "other"] },
        since: {
          type: "string",
          description: "YYYY-MM-DD — only trades on or after this date",
        },
        limit: { type: "number", description: "Max 100. Default: 25." },
      },
    },
  },
  {
    name: "get_market_snapshot",
    description:
      "Get the current price, daily change, 52-week high/low, and volume for a single " +
      "stock/ETF/crypto ticker. Use when the user asks about price levels, daily moves, " +
      "or 52w positioning of any symbol (including SPY, QQQ, BTC-USD).",
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Yahoo-format symbol. Examples: 'AAPL', 'SPY', 'BTC-USD', '^GSPC', 'GC=F' (gold).",
        },
      },
      required: ["symbol"],
    },
  },
];

// ─────────────────────────────────────────────
// Tool handlers
// ─────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

export async function executeTool(name: string, input: ToolInput): Promise<string> {
  try {
    switch (name) {
      case "get_congress_leaderboard":
        return await handleLeaderboard(input);
      case "get_congress_member":
        return await handleMember(input);
      case "get_congress_trades":
        return await handleTrades(input);
      case "get_market_snapshot":
        return await handleMarketSnapshot(input);
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "tool error";
    return `Tool "${name}" failed: ${msg}`;
  }
}

async function handleLeaderboard(input: ToolInput): Promise<string> {
  const period = (typeof input.period === "string" ? input.period : "1y") as CongressStatPeriod;
  const metric = (typeof input.metric === "string"
    ? input.metric
    : "timing_alpha_30d") as CongressRankMetric;
  const limit = Math.min(
    Math.max(typeof input.limit === "number" ? input.limit : 10, 1),
    25,
  );

  const entries = await getLeaderboard({ period, metric, limit, qualifyingOnly: true });
  if (entries.length === 0) {
    return JSON.stringify({
      period, metric, entries: [],
      note: "No qualifying members in this period yet.",
    });
  }
  return JSON.stringify({
    period,
    metric,
    entries: entries.map((e) => ({
      rank: e.rank,
      slug: e.member.id,
      name: e.member.displayName,
      party: e.member.party,
      state: e.member.state,
      chamber: e.member.chamber,
      timing_alpha_30d_pct: e.stats.timingAlpha30dPct,
      timing_alpha_90d_pct: e.stats.timingAlpha90dPct,
      win_rate_30d: e.stats.winRate30d,
      total_trades: e.stats.totalTrades,
      est_volume_usd: e.stats.estVolumeUsd,
      top_symbol: e.stats.topSymbol,
    })),
  });
}

async function handleMember(input: ToolInput): Promise<string> {
  const slug = typeof input.slug === "string" ? input.slug.toLowerCase() : "";
  if (!slug) return `Missing slug.`;
  const profile = await getMemberProfile(slug);
  if (!profile) return JSON.stringify({ error: `Member '${slug}' not found.` });

  return JSON.stringify({
    name: profile.member.displayName,
    slug: profile.member.id,
    party: profile.member.party,
    state: profile.member.state,
    chamber: profile.member.chamber,
    total_trades: profile.member.totalTrades,
    last_traded: profile.member.lastTradedAt?.slice(0, 10),
    stats: profile.stats,
    top_symbols: profile.topSymbols,
    recent_trades: profile.recentTrades.slice(0, 20).map((t) => ({
      date: t.transactionDate,
      symbol: t.symbol,
      type: t.transactionType,
      amount_low: t.amountLow,
      amount_high: t.amountHigh,
      owner: t.ownerType,
    })),
  });
}

async function handleTrades(input: ToolInput): Promise<string> {
  const symbol =
    typeof input.symbol === "string" ? input.symbol.toUpperCase() : undefined;
  const member = typeof input.member === "string" ? input.member : undefined;
  const type =
    typeof input.type === "string" && ["buy", "sell", "exchange", "other"].includes(input.type)
      ? (input.type as CongressTradeType)
      : undefined;
  const since = typeof input.since === "string" ? input.since : undefined;
  const limit = Math.min(
    Math.max(typeof input.limit === "number" ? input.limit : 25, 1),
    100,
  );

  const trades = await queryCongressTrades({
    symbol, memberId: member, transactionType: type, since, limit,
  });
  return JSON.stringify({
    count: trades.length,
    trades: trades.map((t) => ({
      date: t.transactionDate,
      member: t.memberName,
      slug: t.memberId,
      symbol: t.symbol,
      type: t.transactionType,
      amount_low: t.amountLow,
      amount_high: t.amountHigh,
      filing_date: t.filingDate,
    })),
  });
}

async function handleMarketSnapshot(input: ToolInput): Promise<string> {
  const symbol =
    typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
  if (!symbol) return JSON.stringify({ error: "Missing symbol." });

  const t = await safeYahoo(symbol, symbol);
  return JSON.stringify({
    symbol: t.symbol,
    name: t.name,
    price: t.price,
    change: t.change,
    change_pct: t.changePct,
    low_52w: t.low52,
    high_52w: t.high52,
    volume: t.volume,
    fetched_at: new Date().toISOString(),
  });
}
