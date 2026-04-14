import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BuyOrBeSold daily market brief";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Parse a readable title + date from the slug. The slug format is always
// YYYY-MM-DD-title-words-here. We avoid filesystem imports here because this
// route runs on the Edge runtime (required for @vercel/og), which can't read
// markdown files at request time. Title reconstruction from the slug is good
// enough for OG card sharing.
function parseSlug(slug: string): { date: string; title: string } {
  const m = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (!m) return { date: "", title: slug };
  const rest = m[2]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { date: m[1], title: rest };
}

// Satori requires every multi-child div to declare `display: flex`, and it
// treats `A{x}B` as multiple children — prefer template literals.
export default async function OgImage({
  params,
}: {
  params: { slug: string };
}) {
  const { date, title } = parseSlug(params.slug);
  const tags: string[] = [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0b0d11",
          color: "#e9ecf2",
          padding: 72,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "#d4a84a",
          }}
        />

        {/* Logo row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 12,
              border: "2px solid #d4a84a",
              background: "rgba(212,168,74,0.12)",
              color: "#d4a84a",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            B/S
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: 4,
                color: "#e9ecf2",
              }}
            >
              BUYORBESOLD
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 16,
                letterSpacing: 3,
                color: "#8d94a3",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {`DAILY MARKET BRIEF · ${date}`}
            </div>
          </div>
        </div>

        {/* Headline (single text child, safe for any size) */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            fontSize: title.length > 60 ? 58 : 72,
            lineHeight: 1.08,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -1,
          }}
        >
          {title}
        </div>

        {/* Tags + disclaimer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 32,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {tags.slice(0, 4).map((tag) => (
              <div
                key={tag}
                style={{
                  display: "flex",
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid rgba(212,168,74,0.4)",
                  background: "rgba(212,168,74,0.12)",
                  color: "#d4a84a",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              color: "#5a6070",
              fontStyle: "italic",
              fontSize: 16,
            }}
          >
            Not financial advice. Do your own research.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
