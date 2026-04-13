import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isKvAvailable } from "@/lib/kv";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import UserTradeForm from "@/components/UserTradeForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Log Trade — My Journal",
  robots: { index: false, follow: false },
};

export default async function MyJournalNewPage() {
  const email = await getUser();
  if (!email) redirect("/login");

  const kvOn = isKvAvailable();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav
        maxWidth="max-w-[760px]"
        links={[{ href: "/my-journal", label: "← My Journal" }]}
      />
      <main className="mx-auto max-w-[760px] px-4 py-10 xs:py-12">
        <h1 className="font-bebas text-4xl tracking-wide xs:text-5xl">Log a trade</h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[color:var(--muted)]">
          Entry fields are required. Leave exit fields blank to log an open trade — come back to close it later.
        </p>
        {!kvOn && (
          <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 font-mono text-[11px] text-amber-400">
            Storage is temporarily unavailable.
          </div>
        )}
        <div className="mt-8">
          <UserTradeForm />
        </div>
        <SiteFooter minimal />
      </main>
    </div>
  );
}
