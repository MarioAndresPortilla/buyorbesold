import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const rawUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.vercel.app";
const SITE_URL = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d11" },
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "BuyOrBeSold — Markets. Bullion. Bitcoin. No noise.",
    template: "%s — BuyOrBeSold",
  },
  description:
    "Daily market intelligence covering the S&P 500, Bitcoin, gold/silver/bullion, commodities, and macro. Mario's personal takes — not financial advice.",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [
        { url: "/rss.xml", title: "BuyOrBeSold daily brief" },
      ],
    },
  },
  openGraph: {
    title: "BuyOrBeSold — Markets. Bullion. Bitcoin. No noise.",
    description:
      "Daily market brief on stocks, bullion, and bitcoin. Personal takes, public data, no noise.",
    url: SITE_URL,
    siteName: "BuyOrBeSold",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "BuyOrBeSold — Markets. Bullion. Bitcoin. No noise.",
    description: "Daily market brief. Not financial advice.",
    creator: "@itsmarioandres",
  },
  authors: [{ name: "Mario" }],
  creator: "Mario",
  publisher: "BuyOrBeSold",
};

// Runs before hydration to set body[data-theme] from saved preference OR OS
// preference, so the page never flashes the wrong theme (FOUC).
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem('bobs-theme');
    if (saved === 'light' || saved === 'dark') {
      document.body.dataset.theme = saved;
      return;
    }
    var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    document.body.dataset.theme = prefersLight ? 'light' : 'dark';
  } catch (e) {
    document.body.dataset.theme = 'dark';
  }
})();
`.trim();

// JSON-LD for the site itself (WebSite + Organization). Rendered into <head>
// on every page. Brief pages add their own Article schema on top.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "BuyOrBeSold",
      description:
        "Daily market intelligence covering the S&P 500, Bitcoin, bullion, commodities, and macro.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "BuyOrBeSold",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      founder: { "@type": "Person", name: "Mario" },
    },
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body data-theme="dark">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
