import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BuyOrBeSold — Markets. Bullion. Bitcoin. No noise.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori (the underlying renderer) requires every div with multiple children to
// declare `display: flex` explicitly. String interpolations like `A{x}B` count
// as multiple children, so prefer template literals.
export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#0b0d11",
          color: "#e9ecf2",
          padding: 80,
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 16,
            border: "3px solid #d4a84a",
            background: "rgba(212,168,74,0.12)",
            color: "#d4a84a",
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 32,
          }}
        >
          B/S
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: 6,
            color: "#e9ecf2",
            marginBottom: 16,
          }}
        >
          BUYORBESOLD
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: -1,
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex" }}>Markets. Bullion.</div>
          <div style={{ display: "flex", gap: 24 }}>
            <span>Bitcoin.</span>
            <span style={{ color: "#d4a84a" }}>No noise.</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 20,
            color: "#8d94a3",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Daily market brief · Not financial advice
        </div>
      </div>
    ),
    { ...size }
  );
}
