import type { Metadata } from "next";
import { getUser, isAdmin } from "@/lib/auth";
import { listTrades, listUserTrades } from "@/lib/kv";
import { isAiConfigured } from "@/lib/ai";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import SubNav from "@/components/SubNav";
import JournalChat from "@/components/JournalChat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Journal Analyst",
  description:
    "AI analyst for your trading journal. Grounded on your own trades — wins, losses, setups, R-multiples. Not financial advice.",
  alternates: { canonical: "/journal/chat" },
  robots: { index: false, follow: false },
};

export default async function JournalChatPage() {
  const [user, admin] = await Promise.all([getUser(), isAdmin()]);
  const hasAuth = Boolean(user);
  const hasAi = isAiConfigured();

  let tradeCount = 0;
  if (user) {
    const trades = admin
      ? await listTrades(500)
      : await listUserTrades(user, 500);
    tradeCount = trades.length;
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[1100px]" />
      <SubNav
        section="Mario's Journal"
        maxWidth="max-w-[1100px]"
        items={[
          { href: "/journal", label: "Overview" },
          { href: "/journal/analytics", label: "Analytics" },
          { href: "/journal/chat", label: "Analyst" },
          ...(admin ? [{ href: "/journal/new", label: "Log Trade" }] : []),
        ]}
      />

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 xs:py-10">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Journal analyst
          </div>
          <h1 className="font-bebas text-[40px] leading-none tracking-wide xs:text-5xl">
            Ask your trades
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[color:var(--muted)]">
            A grounded analyst for your own trading history. Every number it
            quotes comes from your journal. It doesn&apos;t predict markets and
            it doesn&apos;t give advice — it tells you what the data actually
            says.
          </p>
        </div>

        <JournalChat tradeCount={tradeCount} hasAuth={hasAuth} hasAi={hasAi} />

        <div className="rounded-md border border-[color:var(--border)]/60 bg-[color:var(--surface)]/40 p-4 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
          Not financial advice. Statistical analysis of your own journal only.
          Sample sizes under 20–30 closed trades are noise, not signal.
        </div>

        <SiteFooter minimal />
      </main>
    </div>
  );
}
