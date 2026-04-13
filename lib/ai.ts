import Anthropic from "@anthropic-ai/sdk";
import { getBriefs } from "./briefs";
import type { Brief } from "./types";

/**
 * Thin wrapper around the Anthropic SDK for drafting briefs in Mario's voice.
 *
 * Design:
 * - Single lazy-initialized client, memoized across requests.
 * - System prompt is assembled per call and sent with
 *   cache_control: ephemeral so the 5-minute prompt cache absorbs 90% of
 *   the input cost after the first call in a burst.
 * - Voice guide is built from the current set of published briefs at
 *   request time (no build-time coupling) so Mario can add new exemplar
 *   briefs without a redeploy of this module.
 * - Models: claude-sonnet-4-6 for drafts (cost). claude-opus-4-6 available
 *   as an opt-in for higher-quality work via `{ highQuality: true }`.
 * - Graceful degradation: isAiConfigured() returns false when
 *   ANTHROPIC_API_KEY is missing, so callers can surface a useful error
 *   instead of crashing at request time.
 *
 * Hard rule: no auto-publish. Every function here returns markdown for
 * Mario to review locally, edit, and commit. We do NOT write to
 * content/briefings/ from production code paths.
 */

const MODEL_STANDARD = "claude-sonnet-4-6";
const MODEL_HIGH = "claude-opus-4-6";
const MAX_TOKENS = 2500;

let _client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function getClient(): Anthropic {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  if (_client) return _client;
  _client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
  });
  return _client;
}

/**
 * Structured inputs for an Earnings Reaction draft. Only `ticker` and
 * `quarter` are required — Claude works with whatever else is provided.
 * Warnings are surfaced back when optional inputs are missing so Mario
 * knows which parts of the draft to scrutinize.
 */
export interface EarningsDraftInput {
  /** Stock ticker, e.g. "NVDA". Normalized to uppercase on intake. */
  ticker: string;
  /** Quarter label, e.g. "Q1 FY26". */
  quarter: string;
  /** Report date in YYYY-MM-DD format. Defaults to today if omitted. */
  reportedOn?: string;
  /** Reported EPS. */
  epsActual?: number;
  /** Consensus EPS estimate. */
  epsEst?: number;
  /** Reported revenue in dollars (e.g. 22100000000 for $22.1B). */
  revActual?: number;
  /** Consensus revenue estimate in dollars. */
  revEst?: number;
  /** Freeform notes from Mario about forward guidance. */
  guidance?: string;
  /** Freeform notes about the tape reaction post-print. */
  tapeReaction?: string;
  /** Key technical levels Mario is watching. */
  keyLevels?: number[];
  /** Any additional context Mario wants Claude to weave in. */
  marioNotes?: string;
}

export interface EarningsDraftResult {
  /** Full markdown — frontmatter + body. Paste directly into a new .md file. */
  markdown: string;
  /** Warnings about missing inputs that weakened the draft. */
  warnings: string[];
  /** Claude's self-assessment of draft quality given the inputs. */
  confidence: "high" | "medium" | "low";
}

/**
 * Assemble the cached system block. The voice guide + schema + forbidden
 * phrases are ~2k tokens and cache cleanly across a 5-minute burst, so
 * after the first draft, per-call cost drops to roughly output tokens only.
 */
function buildSystemBlocks(): Array<{
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}> {
  // Pull the 5 most-recent published briefs as voice exemplars. If there
  // are fewer than 5, use whatever exists. If zero, we still ship rules
  // without examples.
  const exemplars = getBriefs()
    .slice(0, 5)
    .map(
      (b: Brief) =>
        `### ${b.title}\n_${b.date} · tags: ${b.tags.join(", ") || "(none)"}_\n\n${b.summary}\n\n${b.take}`
    )
    .join("\n\n---\n\n");

  const voiceGuide = `You are drafting in Mario's voice for BuyOrBeSold — a retail-trader-focused market briefing site positioned as "Markets. Bullion. Bitcoin. No noise."

## Who Mario is
- Solo operator. Small-cap day trader. Publishes a daily brief and runs a retail-focused scanner.
- His audience decides what to trade in the next 48 hours, not what to hold for 3 years.
- He writes for traders, not investors. Every post answers: what's the level, what's the risk, what am I doing next session.

## Voice rules
- Blunt, short sentences. Conversational but never breezy.
- Trader vocabulary: "the tape", "the print", "the bid", "the offer", "setup", "catalyst", "R", "stop", "gamma".
- Never use: "we believe", "in our view", "investors should" — Mario speaks as himself.
- Forbidden phrases: DCF, moat, long-term hold, buy-and-hold, alpha generation, intrinsic value, fair value, coverage, target price, price objective, bull case / bear case framing.
- No breathless hype. No "to the moon". No "this is the one".
- Concrete over abstract. Real prices, real levels, real R-multiples, real timeframes. Not vibes.
- The "not financial advice" disclaimer is load-bearing. Every post closes with it.

## Voice seed — these are Mario's own published briefs
${exemplars || "(No exemplar briefs available — fall back to the rules above.)"}

## Your output contract for earnings briefs

Return valid markdown with YAML frontmatter at the top. Schema:

\`\`\`yaml
---
title: <punchy headline, trader-angle, not investor-angle>
date: <YYYY-MM-DD — use reportedOn if provided, else today>
summary: <1-2 sentences: what the tape did and what it means for a trader>
tags: [<ticker lowercase>, earnings, <sector tag>]
type: earnings
ticker: <TICKER uppercase>
quarter: <"Q1 FY26" or similar>
epsActual: <number or omit>
epsEst: <number or omit>
revActual: <number in dollars or omit>
revEst: <number in dollars or omit>
---
\`\`\`

Then body (600-1200 words). Structure:

1. **The number** — 1 short paragraph. What was reported. Beat/miss on both lines. Plain numbers, no adjectives.
2. **The guide** — 1 paragraph if guidance was provided. Otherwise skip this section.
3. **The tape reaction** — 1-2 paragraphs. What did the stock do pre/post-print. Reference concrete price levels. If tapeReaction notes weren't provided, say "tape reaction not yet in — this is a pre-tape setup" and move on.
4. **The trader setup** — 2-3 paragraphs. This is the Mario-specific value. Where would you buy it back. Where does the thesis break. What's the R on the trade at these levels. Adjacent names to watch (e.g., NVDA earnings = watch AMD, SMCI, ARM for sympathy moves). Concrete levels only.
5. **Risk** — 1 paragraph. What kills this setup. Macro, sector, ticker-specific.

Close the body with exactly this line on its own:
*Not financial advice. Do your own research.*

## Response format rules (strict)
- Your response MUST start with \`---\` (the opening frontmatter delimiter).
- No preamble. No "Here's the draft:". No "Hope this helps." No explanation before or after.
- Mario copies your entire output into a .md file without editing anything outside the body.
- After the final disclaimer line, append one more line on its own:
  \`<!-- AI-CONFIDENCE: high|medium|low -->\`
  Pick confidence based on input quality — low = missing too much to write a strong draft, medium = workable, high = confident draft. This line is stripped before publishing.`;

  return [
    {
      type: "text",
      text: voiceGuide,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function buildUserMessage(input: EarningsDraftInput): string {
  const lines: string[] = [];
  lines.push("Draft an Earnings Reaction brief using the structured inputs below.");
  lines.push("");
  lines.push("## Structured inputs");
  lines.push(`- Ticker: ${input.ticker.toUpperCase()}`);
  lines.push(`- Quarter: ${input.quarter}`);
  if (input.reportedOn) lines.push(`- Reported on: ${input.reportedOn}`);
  if (typeof input.epsActual === "number") {
    lines.push(`- EPS actual: ${input.epsActual}`);
  }
  if (typeof input.epsEst === "number") {
    lines.push(`- EPS estimate: ${input.epsEst}`);
  }
  if (typeof input.revActual === "number") {
    lines.push(
      `- Revenue actual: $${(input.revActual / 1e9).toFixed(2)}B (${input.revActual} raw)`
    );
  }
  if (typeof input.revEst === "number") {
    lines.push(
      `- Revenue estimate: $${(input.revEst / 1e9).toFixed(2)}B (${input.revEst} raw)`
    );
  }
  if (input.guidance) {
    lines.push("");
    lines.push("## Guidance notes");
    lines.push(input.guidance);
  }
  if (input.tapeReaction) {
    lines.push("");
    lines.push("## Tape reaction notes");
    lines.push(input.tapeReaction);
  }
  if (input.keyLevels && input.keyLevels.length > 0) {
    lines.push("");
    lines.push("## Key levels Mario is watching");
    lines.push(input.keyLevels.map((l) => `- ${l}`).join("\n"));
  }
  if (input.marioNotes) {
    lines.push("");
    lines.push("## Mario's additional notes");
    lines.push(input.marioNotes);
  }
  lines.push("");
  lines.push("Output the full markdown now, starting with `---`.");
  return lines.join("\n");
}

/**
 * Draft an Earnings Reaction brief from structured inputs. Returns markdown
 * for Mario to paste into a new file under `content/briefings/_drafts/`
 * and edit before publishing.
 *
 * Never writes to disk. Never publishes. Mario is the editor.
 */
export async function draftEarningsReaction(
  input: EarningsDraftInput,
  opts: { highQuality?: boolean } = {}
): Promise<EarningsDraftResult> {
  if (!isAiConfigured()) {
    throw new Error(
      "ANTHROPIC_API_KEY not set — cannot draft. Add the key to .env.local and Vercel env."
    );
  }
  if (!input.ticker || !input.quarter) {
    throw new Error("ticker and quarter are required");
  }

  const client = getClient();
  const systemBlocks = buildSystemBlocks();
  const userMessage = buildUserMessage(input);

  const response = await client.messages.create({
    model: opts.highQuality ? MODEL_HIGH : MODEL_STANDARD,
    max_tokens: MAX_TOKENS,
    system: systemBlocks,
    messages: [
      { role: "user", content: userMessage },
      // Prefill forces Claude to start with the frontmatter delimiter.
      { role: "assistant", content: "---\n" },
    ],
  });

  // Concatenate text blocks (content is an array of content blocks).
  const raw = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  // The prefill is stripped from response.content, so put it back so the
  // result Mario sees is a valid, complete markdown file starting with ---.
  const fullText = raw.startsWith("---") ? raw : `---\n${raw}`;

  // Extract the AI-CONFIDENCE marker (if present) and strip it from the
  // published markdown.
  const confidenceMatch = fullText.match(
    /<!--\s*AI-CONFIDENCE:\s*(high|medium|low)\s*-->/i
  );
  const confidence: "high" | "medium" | "low" = confidenceMatch
    ? (confidenceMatch[1].toLowerCase() as "high" | "medium" | "low")
    : "medium";
  const markdown = fullText
    .replace(/<!--\s*AI-CONFIDENCE:[^>]*-->/i, "")
    .trim();

  const warnings: string[] = [];
  if (typeof input.epsActual !== "number" && typeof input.epsEst !== "number") {
    warnings.push("No EPS data provided — draft will be thin on the numbers section.");
  }
  if (typeof input.revActual !== "number" && typeof input.revEst !== "number") {
    warnings.push("No revenue data provided — draft will be thin on the numbers section.");
  }
  if (!input.tapeReaction) {
    warnings.push(
      "No tape reaction notes provided — the draft may fabricate the reaction. Review before publishing."
    );
  }
  if (!input.keyLevels || input.keyLevels.length === 0) {
    warnings.push(
      "No key levels provided — the trader-setup section will invent levels. Edit carefully."
    );
  }

  return { markdown, warnings, confidence };
}
