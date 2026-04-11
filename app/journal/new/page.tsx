import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-2 px-3 py-3 xs:px-4 xs:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 xs:gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-bebas text-base tracking-wider text-[color:var(--accent)] xs:h-9 xs:w-9 xs:text-lg">
              B/S
            </span>
            <span className="truncate font-bebas text-lg tracking-wider xs:text-xl">
              BUYORBESOLD
            </span>
          </Link>
          <Link
            href="/journal"
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)] hover:text-[color:var(--accent)] xs:text-[11px]"
          >
            ← Journal
          </Link>
        </div>
      </header>

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

        <p className="mt-16 border-t border-[color:var(--border)]/70 pt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Not financial advice.
        </p>
      </main>
    </div>
  );
}
