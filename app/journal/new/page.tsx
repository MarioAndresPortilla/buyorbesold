import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import SubNav from "@/components/SubNav";
import { isAdmin, isAuthConfigured } from "@/lib/auth";
import { isKvAvailable } from "@/lib/kv";
import NewTradeForm from "@/components/NewTradeForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Log trade",
  description: "Log a new trade to the BuyOrBeSold trading journal.",
  robots: { index: false, follow: false },
};

export default async function NewTradePage() {
  const admin = await isAdmin();
  if (!admin) {
    redirect("/login?error=forbidden");
  }

  const kvOn = isKvAvailable();
  const authOn = isAuthConfigured();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[760px]" />
      <SubNav
        section="Mario's Journal"
        maxWidth="max-w-[760px]"
        items={[
          { href: "/journal", label: "Overview" },
          { href: "/journal/new", label: "Log Trade" },
          { href: "/journal/analytics", label: "Analytics" },
        ]}
      />

      <main className="mx-auto max-w-[760px] px-4 py-10 xs:py-12">
        <h1 className="font-bebas text-4xl tracking-wide xs:text-5xl">
          Log a trade
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[color:var(--muted)]">
          Entry fields are required. Exit fields are optional — leave them
          blank to log an open trade, then come back to close it when you
          exit.
        </p>

        {!kvOn && (
          <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 font-mono text-[11px] leading-relaxed text-amber-400">
            KV storage is not provisioned. The form will submit but nothing will
            persist until you link a Vercel KV store.
          </div>
        )}

        {!authOn && (
          <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 font-mono text-[11px] text-red-400">
            Auth is not configured. This page won't save anything.
          </div>
        )}

        <div className="mt-8">
          <NewTradeForm />
        </div>

        <SiteFooter minimal />
      </main>
    </div>
  );
}
