import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import NewsletterSignup from "@/components/NewsletterSignup";

export const metadata = {
  title: "Newsletter — BuyOrBeSold",
  description:
    "Get the BuyOrBeSold daily brief in your inbox every weekday. Markets, bullion, bitcoin, macro. Not financial advice.",
};

export default function NewsletterPage() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[760px]" />

      <main className="mx-auto max-w-[620px] px-4 py-12 xs:py-16">
        <span className="inline-block rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
          Daily Brief
        </span>
        <h1 className="mt-5 font-bebas text-[42px] leading-[0.95] tracking-wide xs:text-5xl sm:text-6xl">
          One email.
          <br />
          Every weekday.
          <br />
          <span className="text-[color:var(--accent)]">Zero noise.</span>
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-[color:var(--muted)] xs:text-lg">
          The BuyOrBeSold daily brief covers the S&amp;P 500, bitcoin, gold, silver,
          commodities, and the macro that actually moves them — plus my personal take on
          what I'm watching and why. No pumping. No affiliate bait. No 40-email sales
          funnels.
        </p>

        <div className="mt-10">
          <NewsletterSignup
            heading="Subscribe"
            sub="Delivered weekday mornings. Unsubscribe anytime."
          />
        </div>

        <div className="mt-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <h3 className="font-bebas text-2xl tracking-wide">FAQ</h3>
          <dl className="mt-4 space-y-4 text-[14px] text-[color:var(--muted)]">
            <div>
              <dt className="font-semibold text-[color:var(--text)]">Is this financial advice?</dt>
              <dd>
                No. Everything I publish is my personal take on public market data. I'm
                not a licensed advisor. Do your own research.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[color:var(--text)]">How often will you email me?</dt>
              <dd>Once per weekday morning. That's it.</dd>
            </div>
            <div>
              <dt className="font-semibold text-[color:var(--text)]">Will you sell my email?</dt>
              <dd>No. It's only used to send you the brief.</dd>
            </div>
          </dl>
        </div>

        <SiteFooter minimal />
      </main>
    </div>
  );
}
