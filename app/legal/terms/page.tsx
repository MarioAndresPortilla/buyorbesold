import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import SubNav from "@/components/SubNav";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms of use for BuyOrBeSold.com. Personal market commentary, not financial advice.",
  alternates: { canonical: "/legal/terms" },
};

const LAST_UPDATED = "2026-04-11";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[760px]" />
      <SubNav
        section="Legal"
        maxWidth="max-w-[760px]"
        items={[
          { href: "/legal/privacy", label: "Privacy" },
          { href: "/legal/terms", label: "Terms" },
        ]}
      />

      <main className="mx-auto max-w-[720px] px-4 py-10 xs:py-12">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Last updated · {LAST_UPDATED}
        </div>
        <h1 className="font-bebas text-4xl leading-none tracking-wide xs:text-5xl">
          Terms of Use
        </h1>

        <div className="mt-8 space-y-6 text-[14px] leading-relaxed text-[color:var(--muted)]">
          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Not financial advice — for real
            </h2>
            <p>
              Every page, every email, and every post on BuyOrBeSold.com
              contains personal opinions and commentary on publicly available
              market data. Nothing on this site is investment advice, a
              recommendation to buy or sell any security, or an offer or
              solicitation of any kind.
            </p>
            <p>
              Mario is not a registered investment advisor, broker-dealer, or
              financial professional. You alone are responsible for your own
              research, your own risk management, and your own trading and
              investment decisions. You can and will lose money trading
              speculative markets. Size accordingly.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Accuracy of market data
            </h2>
            <p>
              Market data is sourced from free, public APIs (Yahoo Finance,
              CoinGecko, Finnhub, alternative.me). It may be delayed,
              incomplete, or wrong. We make no warranty of any kind about data
              accuracy or timeliness. Don't use this site as the sole source
              for real-money trading decisions.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Scanner and journal
            </h2>
            <p>
              The day trader scanner returns stocks that match a pattern
              filter. It is a tool, not a recommendation. A result on the
              scanner is not an endorsement to buy or short any stock.
            </p>
            <p>
              The public trading journal displays Mario's personal trades. It
              is published after the fact for transparency and educational
              purposes. Do not treat it as a signal service or a trade-copy
              feed. Past performance is not indicative of future results.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Use at your own risk
            </h2>
            <p>
              The site is provided "as is" without warranty of any kind. To
              the maximum extent permitted by law, BuyOrBeSold.com and its
              owner are not liable for any direct, indirect, incidental,
              special, consequential, or exemplary damages arising from your
              use of the site or reliance on any content.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Content ownership
            </h2>
            <p>
              All original text, analysis, and design on BuyOrBeSold.com is
              © {new Date().getFullYear()} Mario and may not be republished
              in full without permission. You're welcome to quote short
              excerpts with attribution and a link back.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Changes to these terms
            </h2>
            <p>
              These terms may be updated from time to time. Continued use of
              the site after changes means you accept the updated version.
              Material changes will be announced in the newsletter.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
              Contact
            </h2>
            <p>
              Questions? Email{" "}
              <a
                href="mailto:mario@buyorbesold.com"
                className="text-[color:var(--accent)] hover:underline"
              >
                mario@buyorbesold.com
              </a>
              .
            </p>
          </section>
        </div>

        <SiteFooter minimal />
      </main>
    </div>
  );
}
