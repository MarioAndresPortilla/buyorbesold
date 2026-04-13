import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BuyOrBeSold.com handles your personal information. We collect email addresses for the newsletter and nothing else.",
  alternates: { canonical: "/legal/privacy" },
};

const LAST_UPDATED = "2026-04-11";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[760px]" />

      <main className="mx-auto max-w-[720px] px-4 py-10 xs:py-12">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Last updated · {LAST_UPDATED}
        </div>
        <h1 className="font-bebas text-4xl leading-none tracking-wide xs:text-5xl">
          Privacy Policy
        </h1>

        <div className="prose prose-invert mt-8 space-y-6 text-[14px] leading-relaxed text-[color:var(--muted)]">
          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              What we collect
            </h2>
            <p>
              BuyOrBeSold.com is a personal publishing site. We collect the
              minimum required to operate it:
            </p>
            <ul className="list-disc pl-5">
              <li>
                <strong>Email address</strong> — only when you voluntarily
                submit it to the newsletter sign-up form. Stored in Vercel KV
                and/or Resend for the sole purpose of delivering the daily
                brief.
              </li>
              <li>
                <strong>Anonymous analytics</strong> — Vercel Analytics and
                Speed Insights collect aggregated, anonymous page view and
                performance data. No cookies, no personal identifiers, no
                cross-site tracking.
              </li>
              <li>
                <strong>Session cookie (admin only)</strong> — if you sign in
                to the trading journal as the admin, we set one HTTP-only
                cookie containing a signed JWT. This cookie is strictly
                necessary for admin access and is not used for tracking.
              </li>
              <li>
                <strong>IP address</strong> — temporarily, for rate limiting
                of sign-ups and sign-in attempts. IPs are never persisted
                long-term or associated with any identity.
              </li>
            </ul>
            <p>We do not use third-party advertising networks or data brokers.</p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              How we use it
            </h2>
            <p>
              Your email address is used only to send you the daily brief and,
              optionally, account-related messages (magic-link sign-in). We do
              not sell, rent, or share your email with anyone.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              How to unsubscribe
            </h2>
            <p>
              Every newsletter email includes a one-click unsubscribe link in
              the footer (and a Gmail-native unsubscribe button at the top).
              Clicking it instantly removes your email from our list, and no
              confirmation is required. You can also email{" "}
              <a
                href="mailto:mario@buyorbesold.com"
                className="text-[color:var(--accent)] hover:underline"
              >
                mario@buyorbesold.com
              </a>{" "}
              to be removed manually.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Data we share with third parties
            </h2>
            <ul className="list-disc pl-5">
              <li>
                <strong>Resend</strong> — receives your email so we can send
                you the newsletter. Their privacy policy is at{" "}
                <a
                  href="https://resend.com/legal/privacy-policy"
                  className="text-[color:var(--accent)] hover:underline"
                >
                  resend.com/legal/privacy-policy
                </a>
                .
              </li>
              <li>
                <strong>Vercel</strong> — hosts the site and the KV database.
                Their privacy policy is at{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  className="text-[color:var(--accent)] hover:underline"
                >
                  vercel.com/legal/privacy-policy
                </a>
                .
              </li>
            </ul>
            <p>
              Public market data sources (Yahoo Finance, CoinGecko, Finnhub,
              alternative.me) never receive any information about you —
              they're queried from our server, not from your browser.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Your rights
            </h2>
            <p>
              You can request a copy of the data we have about you, or delete
              it, by emailing{" "}
              <a
                href="mailto:mario@buyorbesold.com"
                className="text-[color:var(--accent)] hover:underline"
              >
                mario@buyorbesold.com
              </a>
              . We'll respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Changes to this policy
            </h2>
            <p>
              We'll update the "Last updated" date at the top of this page and,
              for material changes, notify newsletter subscribers by email.
            </p>
          </section>
        </div>

        <SiteFooter minimal />
      </main>
    </div>
  );
}
