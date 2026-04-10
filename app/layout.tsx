import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuyOrBeSold — Markets. Bullion. Bitcoin. No noise.",
  description:
    "Daily market intelligence covering the S&P 500, Bitcoin, gold/silver/bullion, commodities, and macro. Mario's personal takes — not financial advice.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.com"
  ),
  openGraph: {
    title: "BuyOrBeSold — Markets. Bullion. Bitcoin. No noise.",
    description:
      "Daily market brief on stocks, bullion, and bitcoin. Personal takes, public data, no noise.",
    url: "https://buyorbesold.com",
    siteName: "BuyOrBeSold",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BuyOrBeSold — Markets. Bullion. Bitcoin. No noise.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-theme="dark">{children}</body>
    </html>
  );
}
