import Anthropic from "@anthropic-ai/sdk";
import type { Brief, MarketData, ScannerResult } from "./types";
import { formatPrice, formatPct } from "./format";

/**
 * AI brief generator using the Claude API.
 *
 * Takes live market data + scanner results and produces a brief in Mario's
 * voice for a specific edition (premarket / midday / postmarket).
 *
 * The prompt is carefully tuned to Mario's style: opinionated, direct, uses
 * "I" and "my", references actual positions, never hedges with "could go
 * either way", always includes a personal take. Not financial advice.
 */

export type BriefEdition = "premarket" | "midday" | "postmarket";

const EDITION_CONFIG: Record<
  BriefEdition,
  { timeLabel: string; focus: string; tone: string }
> = {
  premarket: {
    timeLabel: "Pre-Market",
    focus:
      "What happened overnight, key levels to watch today, which setups from the scanner look actionable, what economic data drops today, and how I'm positioned going into the open.",
    tone:
      "Forward-looking and decisive. Tell readers exactly what you're watching and why. Be specific about price levels.",
  },
  midday: {
    timeLabel: "Midday",
    focus:
      "How the morning session played out vs expectations, what's setting up for power hour (2-4pm ET), any scanner picks that triggered or failed, and whether the tape character has changed since the open.",
    tone:
      "Reactive and tactical. What worked, what didn't, what's shifting. Keep it punchy — readers are checking between trades.",
  },
  postmarket: {
    timeLabel: "Post-Market",
    focus:
      "Full session recap, what moved and why, how my positions are sitting at the close, what the scanner flagged that actually ran, after-hours movers, and what I'm watching tomorrow.",
    tone:
      "Reflective but concrete. Grade the day. Acknowledge what was wrong. Highlight what was right. Set up tomorrow.",
  },
};

function buildMarketContext(market: MarketData): string {
  const lines: string[] = [
    `S&P 500: ${formatPrice(market.sp500.price)} (${formatPct(market.sp500.changePct)})`,
    `Bitcoin: ${formatPrice(market.bitcoin.price)} (${formatPct(market.bitcoin.changePct)})`,
    `Gold: ${formatPrice(market.gold.price)} (${formatPct(market.gold.changePct)})`,
    `Silver: ${formatPrice(market.silver.price)} (${formatPct(market.silver.changePct)})`,
    `Crude Oil: ${formatPrice(market.crude.price)} (${formatPct(market.crude.changePct)})`,
    `Natural Gas: ${formatPrice(market.natgas.price)} (${formatPct(market.natgas.changePct)})`,
    `DXY: ${market.dxy.price.toFixed(3)} (${formatPct(market.dxy.changePct)})`,
    `10Y Yield: ${market.tnx.price.toFixed(3)}% (${formatPct(market.tnx.changePct)})`,
    `Stock Market Fear & Greed (CNN): ${market.fearGreed.stock.score} (${market.fearGreed.stock.label})`,
    `Crypto Fear & Greed: ${market.fearGreed.crypto.score} (${market.fearGreed.crypto.label})`,
    "",
    "Sector performance:",
    ...market.sectors.map(
      (s) => `  ${s.code}: ${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%`
    ),
  ];
  return lines.join("\n");
}

function buildScannerContext(scanner: ScannerResult): string {
  if (!scanner.topLongs.length && !scanner.topShorts.length) {
    return "Scanner: No setups matched criteria today (may be pre-market or weekend).";
  }
  const lines: string[] = [
    `Scanner scanned ${scanner.candidateCount} tickers, ${scanner.qualifiedCount} qualified.`,
  ];
  if (scanner.topLongs.length) {
    lines.push("Top long setups:");
    scanner.topLongs.forEach((c, i) =>
      lines.push(
        `  ${i + 1}. ${c.symbol} $${c.price.toFixed(2)} ${formatPct(c.changePct)} RVOL=${c.rvol.toFixed(1)}x ${c.smaBounce ?? ""} Float=${c.float ? (c.float / 1e6).toFixed(1) + "M" : "?"} [${c.tags.join(", ")}]`
      )
    );
  }
  if (scanner.topShorts.length) {
    lines.push("Top short setups:");
    scanner.topShorts.forEach((c, i) =>
      lines.push(
        `  ${i + 1}. ${c.symbol} $${c.price.toFixed(2)} ${formatPct(c.changePct)} RVOL=${c.rvol.toFixed(1)}x ${c.smaBounce ?? ""} [${c.tags.join(", ")}]`
      )
    );
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Mario, the voice behind BuyOrBeSold.com. You're a personal finance creator, active day trader, and entrepreneur. You trade small-cap stocks ($1-$20, low float, high RVOL) and also hold longer-term positions in bullion, Bitcoin, and index funds.

Your writing style:
- First person: "I", "my", "I'm watching", "I took a position"
- Opinionated and direct — never say "could go either way" or "time will tell"
- Use specific price levels and percentages, not vague directional calls
- Mention actual tickers when they're relevant
- Short punchy sentences mixed with one longer analytical thought
- Reference the Fear & Greed Index when it's extreme (<20 or >80)
- Always end with what you're actually doing, not what you think "the market" will do
- Never say "Not financial advice" in the body — that goes in the footer, not the brief

Output format — respond with EXACTLY this JSON structure, nothing else:
{
  "title": "Brief headline (compelling, specific, 8-15 words)",
  "summary": "1-2 sentence summary for the card preview. Specific and hooky.",
  "take": "The full brief body. 2-4 paragraphs. This is Mario's voice — opinionated, personal, references actual data from the context provided. 150-300 words.",
  "tags": ["tag1", "tag2", "tag3"]
}`;

export async function generateBrief(
  edition: BriefEdition,
  market: MarketData,
  scanner: ScannerResult
): Promise<Brief> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const config = EDITION_CONFIG[edition];
  const today = new Date().toISOString().slice(0, 10);
  const marketCtx = buildMarketContext(market);
  const scannerCtx = buildScannerContext(scanner);

  const userPrompt = `Write the ${config.timeLabel} brief for ${today}.

FOCUS: ${config.focus}

TONE: ${config.tone}

LIVE MARKET DATA:
${marketCtx}

SCANNER OUTPUT:
${scannerCtx}

Remember: output ONLY the JSON object with title, summary, take, and tags. No markdown fences, no explanation.`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  // Parse the JSON response. Claude is reliable about outputting clean JSON
  // when instructed, but we guard against stray markdown fences.
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: {
    title: string;
    summary: string;
    take: string;
    tags: string[];
  };

  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[ai-brief] JSON parse failed:", text.slice(0, 500));
    throw new Error("AI brief generation returned invalid JSON");
  }

  if (!parsed.title || !parsed.summary || !parsed.take) {
    throw new Error("AI brief missing required fields");
  }

  const slug = `${today}-${edition}`;

  return {
    slug,
    date: today,
    title: parsed.title,
    summary: parsed.summary,
    take: parsed.take,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [edition],
    type: "brief",
  };
}
