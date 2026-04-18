import { getAllBriefs } from "@/lib/briefs";

export const runtime = "nodejs";
export const revalidate = 60;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.vercel.app";

// Minimal escape for characters that would break XML attribute/text content.
function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(dateStr: string): string {
  try {
    return new Date(dateStr).toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

export async function GET() {
  // Use async version so AI-generated briefs (stored in KV) show up too,
  // not just the hand-written markdown ones. Cap at 50 most recent so the
  // feed file stays lean.
  const briefs = (await getAllBriefs()).slice(0, 50);
  const buildDate = rfc822(briefs[0]?.date ?? new Date().toISOString());

  const items = briefs
    .map((b) => {
      const url = `${SITE_URL}/briefings/${b.slug}`;
      const body = `${b.summary}\n\n${b.take}\n\nNot financial advice. Do your own research.`;
      return `    <item>
      <title>${escape(b.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(b.publishedAt ?? b.date)}</pubDate>
      <description>${escape(body)}</description>
      ${b.tags.map((t) => `<category>${escape(t)}</category>`).join("\n      ")}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>BuyOrBeSold — Daily Brief</title>
    <link>${SITE_URL}</link>
    <description>Daily market intelligence: stocks, bullion, bitcoin, macro. Not financial advice.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
    },
  });
}
