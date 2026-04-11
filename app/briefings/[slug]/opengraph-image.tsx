import { ImageResponse } from "next/og";
import { getBriefBySlug } from "@/lib/briefs";

export const runtime = "edge";
export const alt = "BuyOrBeSold daily market brief";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori requires every multi-child div to declare `display: flex`, and it
// treats `A{x}B` as multiple children — prefer template literals.
export default async function OgImage({
  params,
}: {
  params: { slug: string };
}) {
  const brief = getBriefBySlug(params.slug);
  const title = brief?.title ?? "Daily Market Brief";
  const date = brief?.date ?? "";
  const tags = brief?.tags ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          color: "#e5e7eb",
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
            background: "#c9a84c",
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
              border: "2px solid #c9a84c",
              background: "rgba(201,168,76,0.12)",
              color: "#c9a84c",
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
                color: "#e5e7eb",
              }}
            >
              BUYORBESOLD
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 16,
                letterSpacing: 3,
                color: "#9ca3af",
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
                  border: "1px solid rgba(201,168,76,0.4)",
                  background: "rgba(201,168,76,0.12)",
                  color: "#c9a84c",
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
              color: "#6b7280",
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
