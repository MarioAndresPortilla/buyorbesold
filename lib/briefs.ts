import type { Brief } from "./types";

// In-file brief store for MVP. Replace with markdown files or a CMS in phase 2.
export const BRIEFS: Brief[] = [
  {
    slug: "2026-04-10-bullion-still-has-room",
    date: "2026-04-10",
    title: "Bullion still has room, and nobody's talking about it",
    summary:
      "Gold and silver are quietly grinding higher while everyone argues about tech earnings. The setup looks familiar.",
    take:
      "I keep saying it: bullion is the trade that doesn't need a headline to work. Central banks kept buying through the last leg up, real yields haven't ripped against the metal, and retail is still parked in cash and large-cap tech. That's the ingredient list for slow, grinding upside — not a vertical move. I'm still long physical and miners, still not chasing, still sizing like someone who wants to be around next year.",
    tags: ["gold", "silver", "bullion", "macro"],
  },
  {
    slug: "2026-04-09-spx-vs-btc-correlation",
    date: "2026-04-09",
    title: "SPX and BTC are trading like the same asset again",
    summary:
      "The 30-day correlation between the S&P 500 and Bitcoin just flipped back above 0.7. That matters for how you size.",
    take:
      "Bitcoin is not a diversifier right now. When SPX sneezes, BTC catches it — and that's fine, as long as you're honest about it in your risk budget. Stop pretending a 60/40 with a 5% BTC sleeve is hedged. It isn't. It's just a beta sleeve with extra volatility. Either you want that exposure or you don't.",
    tags: ["bitcoin", "sp500", "risk"],
  },
  {
    slug: "2026-04-08-cpi-week-setup",
    date: "2026-04-08",
    title: "CPI week: what I'm watching and what I'm ignoring",
    summary:
      "Headline inflation prints Thursday. Here's the 60-second version of what moves and what doesn't.",
    take:
      "Core services ex-housing is the only line that matters to the Fed's reaction function right now. Headline will make the news, core will make the tape. I don't trade the print — I trade the reaction to the reaction, usually the next day. If the dollar fades on a hot number, that's the tell.",
    tags: ["cpi", "macro", "fed"],
  },
];

export function getBriefs(): Brief[] {
  return [...BRIEFS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getLatestBrief(): Brief {
  return getBriefs()[0];
}

export function getBriefBySlug(slug: string): Brief | undefined {
  return BRIEFS.find((b) => b.slug === slug);
}
