/** @type {import('next').NextConfig} */

// Security headers applied to every response.
// - Strict-Transport-Security: force HTTPS for 2 years once seen
// - X-Frame-Options: deny framing (clickjacking protection)
// - X-Content-Type-Options: nosniff (stops MIME sniffing)
// - Referrer-Policy: strict-origin-when-cross-origin (reasonable privacy default)
// - Permissions-Policy: disable unused browser features entirely
// - Content-Security-Policy: allow self + fonts.googleapis/gstatic + Vercel Analytics
//   Also permits Yahoo/CoinGecko/Finnhub API hosts via connect-src since the
//   client-side /dashboard polls /api/markets, which is same-origin anyway.
//   Inline styles allowed because Tailwind's generated CSS uses them at runtime.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs 'unsafe-inline' for its theme-init script + 'unsafe-eval'
      // in dev. We allow both in prod; hash-based CSP is a future hardening step.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://vitals.vercel-insights.com https://*.vercel-insights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // removes "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
