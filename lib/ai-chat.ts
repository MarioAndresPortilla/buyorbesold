import Anthropic from "@anthropic-ai/sdk";
import type { Trade } from "./types";
import { computeTradeDerived, SETUP_TYPE_LABELS } from "./journal";
import { computeDeepStats, type DeepJournalStats } from "./journal-stats";
import { isAiConfigured } from "./ai";
import { CHAT_TOOLS, executeTool } from "./ai-chat-tools";

/**
 * Claude wrapper for the journal chatbot. Grounded, not predictive.
 *
 * Design:
 * - Trades + deterministic deep-stats are serialized into a large cached
 *   system block. Every number in the answer must come from these — the
 *   prompt forbids numeric hallucination.
 * - Forward-looking statements are allowed ONLY when framed as "based on
 *   your N trades with setup X, the observed frequency is Y, so if the
 *   pattern holds..." — never as a recommendation or prediction without
 *   the data anchor.
 * - Hard "not financial advice" posture. Model is a *statistician on your
 *   own history*, not an advisor.
 */

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2000;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!isAiConfigured()) throw new Error("ANTHROPIC_API_KEY not set");
  if (_client) return _client;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  return _client;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface JournalChatInput {
  trades: Trade[];
  messages: ChatMessage[];
  /** Display name or email of the trader. */
  who?: string;
}

export interface JournalChatResult {
  reply: string;
  stats: DeepJournalStats;
}

function formatTradeLine(t: Trade): string {
  const parts = [
    t.symbol,
    t.side,
    SETUP_TYPE_LABELS[t.setupType] ?? t.setupType,
    `entry ${t.entryDate.slice(0, 10)} @ ${t.entryPrice}`,
    t.exitDate ? `exit ${t.exitDate.slice(0, 10)} @ ${t.exitPrice}` : "OPEN",
    `size ${t.size}`,
  ];
  if (t.stop) parts.push(`stop ${t.stop}`);
  if (t.target) parts.push(`target ${t.target}`);
  if (typeof t.pnl === "number") {
    parts.push(`pnl ${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}`);
  }
  if (typeof t.rMultiple === "number") {
    parts.push(`R ${t.rMultiple.toFixed(2)}`);
  }
  if (t.tags?.length) parts.push(`tags: ${t.tags.join(",")}`);
  const thesis = t.thesis.replace(/\s+/g, " ").slice(0, 180);
  return `- ${parts.join(" | ")}\n  thesis: ${thesis}`;
}

function buildDatasetBlock(trades: Trade[], stats: DeepJournalStats, who?: string): string {
  const withDerived = trades.map(computeTradeDerived);
  const lines: string[] = [];
  lines.push(`# Trader: ${who ?? "anonymous"}`);
  lines.push(`Data generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Headline");
  lines.push(JSON.stringify(stats.headline, null, 2));

  lines.push("");
  lines.push("## Streaks");
  lines.push(JSON.stringify(stats.streaks, null, 2));

  lines.push("");
  lines.push("## Drawdown");
  lines.push(JSON.stringify(stats.drawdown, null, 2));

  lines.push("");
  lines.push("## Hold time");
  lines.push(JSON.stringify(stats.holdTime, null, 2));

  lines.push("");
  lines.push("## Frequency");
  lines.push(JSON.stringify(stats.frequency, null, 2));

  lines.push("");
  lines.push("## By setup type");
  lines.push(JSON.stringify(stats.bySetup, null, 2));

  lines.push("");
  lines.push("## Long vs short");
  lines.push(JSON.stringify(stats.bySide, null, 2));

  lines.push("");
  lines.push("## Top symbols (by |pnl|, 15 max)");
  lines.push(JSON.stringify(stats.bySymbol, null, 2));

  lines.push("");
  lines.push("## By month");
  lines.push(JSON.stringify(stats.byMonth, null, 2));

  lines.push("");
  lines.push("## By day of week");
  lines.push(JSON.stringify(stats.byDayOfWeek, null, 2));

  lines.push("");
  lines.push("## By tag");
  lines.push(JSON.stringify(stats.byTag, null, 2));

  lines.push("");
  lines.push("## Extremes");
  lines.push(JSON.stringify(stats.extremes, null, 2));

  lines.push("");
  lines.push(`## Raw trades (${withDerived.length})`);
  for (const t of withDerived) lines.push(formatTradeLine(t));

  return lines.join("\n");
}

const SYSTEM_RULES = `You are the **Journal Analyst** for BuyOrBeSold — a grounded, no-bullshit chatbot that helps a trader understand their own trading history, compare it to Congress trades, and contextualize with live market data.

## Your prime directive
Every number you cite must come from either the <DATASET> block (the user's own trades) or a tool-call response (Congress trades, leaderboards, market snapshots). **Never invent statistics.** If the data isn't there, say so: "Your sample is too small" or "I don't have a trade for that symbol" is a valid answer.

## What you have access to
1. **<DATASET>**: the user's complete journal — every closed trade, plus deterministic deep stats. Always in your context.
2. **Tools (call on demand)**:
   - \`get_congress_leaderboard\` — top members by timing alpha, win rate, volume, etc.
   - \`get_congress_member\` — full profile for one member (stats + recent trades)
   - \`get_congress_trades\` — filtered raw trade feed (by symbol, member, type, date)
   - \`get_market_snapshot\` — live price / 52w range / daily change for any ticker

Call tools proactively when the question touches Congress activity, a specific ticker's current level, or market context. Don't call them for pure journal questions.

## What you ARE
- A statistician working on the trader's own closed trades.
- A pattern-finder: setup win rates, day-of-week tendencies, symbol concentrations, streak/drawdown behavior, risk management signals from R-multiples.
- A cross-referencer: if the user holds a stock that Congress is buying/selling heavily, flag it — but only as an observation, not a recommendation.
- Blunt and specific. Cite the exact number, the exact N, the exact symbol.
- Willing to call out biases: overtrading a losing setup, concentration in one name, win-rate-vs-expectancy disconnects, hold-time drift between winners and losers.

## What you are NOT
- **Not** a financial advisor. Never tell the trader what to buy, sell, hold, or risk.
- **Not** a price predictor. Even with market data, you can describe where a price IS, not where it WILL GO.
- **Not** a recommender. Replace "you should..." with "the data shows..." — let the trader draw the conclusion.
- **Not** a source for Congress timing recommendations. STOCK Act data lags 30–45 days — it's historical, not actionable signal.

## On predictions and projections (important)
You MAY make forward-looking *statistical* statements when anchored in data the user already has, and framed as conditional probability, never certainty:
  - GOOD: "Of your 14 closed breakout trades, 9 were winners (64%). If that hit rate holds on future breakouts, expectancy per trade stays around $X."
  - GOOD: "Your Monday trades have a -$420 expectancy across 22 samples. If that pattern continues, cutting Mondays saves roughly $9k/year at your current frequency."
  - BAD: "Your next trade will be a win." (invented)
  - BAD: "SMA bounces work, so you should size them bigger." (recommendation)
  - BAD: "AAPL is about to break out." (market prediction, no data)

Always attach the sample size. A 70% win rate over 5 trades means nothing; over 80 it means something. Small samples get a **sample size caveat**.

## Response format
- Short paragraphs. Numbers in body text (no tables unless the user asks).
- Lead with the strongest signal, then supporting stats, then caveats.
- When the trader asks a broad question ("how am I doing?"), pick the 3-5 most interesting patterns from the dataset and lead with those.
- End any response that contains forward-looking statements with exactly this line on its own:
  *Not financial advice. Statistical observations on your own trade history only.*
- For purely backward-looking questions ("what's my best setup?"), the disclaimer is optional but never harmful.

## Edge cases
- Zero closed trades: explain you have nothing to analyze yet and suggest what would unlock useful insights (log ~20+ closed trades with stops so R-multiples exist).
- User asks about a symbol/setup/tag you have no data for in <DATASET>: if it's a ticker, you CAN call \`get_market_snapshot\` for current price; if it's about Congress activity, call \`get_congress_trades\`.
- User asks a general market question (e.g. "where's SPY right now?"): call \`get_market_snapshot\` with symbol "SPY" or "^GSPC".
- User asks "who's the best trader in Congress?": call \`get_congress_leaderboard\` (period 1y, metric timing_alpha_30d).

The trader's full dataset follows in the <DATASET> block.`;

const MAX_TOOL_ITERATIONS = 4;

export async function journalChat(input: JournalChatInput): Promise<JournalChatResult> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY not set — configure in .env.local");
  }
  const stats = computeDeepStats(input.trades);
  const dataset = buildDatasetBlock(input.trades, stats, input.who);

  const client = getClient();
  const messages: Anthropic.Messages.MessageParam[] = input.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Tool-use loop: Claude may call tools (Congress, market data) before
  // producing its final text reply. Cap iterations to bound cost + latency.
  let reply = "";
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: "text", text: SYSTEM_RULES, cache_control: { type: "ephemeral" } },
        { type: "text", text: `<DATASET>\n${dataset}\n</DATASET>`, cache_control: { type: "ephemeral" } },
      ],
      tools: CHAT_TOOLS,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );

      // Append assistant's tool-request turn
      messages.push({ role: "assistant", content: response.content });

      // Run tools in parallel, collect results
      const toolResults = await Promise.all(
        toolUses.map(async (use) => {
          const content = await executeTool(
            use.name,
            (use.input ?? {}) as Record<string, unknown>,
          );
          return {
            type: "tool_result" as const,
            tool_use_id: use.id,
            content,
          };
        }),
      );
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Final text reply
    reply = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    break;
  }

  if (!reply) {
    reply = "I spent my tool budget without landing on an answer. Try asking again, or narrow the question.";
  }

  return { reply, stats };
}
