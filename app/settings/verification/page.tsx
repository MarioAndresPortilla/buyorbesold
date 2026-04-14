import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import BrokerConnect from "@/components/BrokerConnect";
import { getUser } from "@/lib/auth";
import { query, first } from "@/lib/db";

export const metadata: Metadata = {
  title: "Verification",
  description: "Connect your broker account to verify your trade history.",
};

interface SearchParams {
  success?: string;
  error?: string;
  imported?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

interface TraderRow {
  id: string;
  verification: "self-reported" | "screenshot" | "broker-linked" | "exchange-api";
  broker_source: string | null;
  updated_at: string;
}

export default async function VerificationPage({ searchParams }: PageProps) {
  const user = await getUser().catch(() => null);
  if (!user) redirect("/login");

  const params = await searchParams;

  // Look up the trader profile for the logged-in user
  const trader = first(
    await query<TraderRow>`
      SELECT id, verification, broker_source, updated_at
      FROM traders WHERE email = ${user.sub}
    `
  );

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[900px] px-3 py-6 xs:px-4">
        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="font-bebas text-2xl tracking-wider">Verification</h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
            Broker &amp; proof
          </span>
        </div>

        {/* ── Status banners ── */}
        {params.success && (
          <div className="mb-4 rounded-lg border border-[color:var(--up)]/40 bg-[color:var(--up)]/10 px-4 py-3 font-mono text-[12px] text-[color:var(--up)]">
            &#10003; Connected successfully.
            {params.imported && ` Imported ${params.imported} trades.`}
          </div>
        )}
        {params.error && (
          <div className="mb-4 rounded-lg border border-[color:var(--down)]/40 bg-[color:var(--down)]/10 px-4 py-3 font-mono text-[12px] text-[color:var(--down)]">
            Connection failed: {params.error}
          </div>
        )}

        {/* ── Trader not found fallback ── */}
        {!trader ? (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
            <h2 className="font-bebas text-lg tracking-wider mb-2">
              Profile not set up
            </h2>
            <p className="font-mono text-[12px] text-[color:var(--muted)]">
              A trader profile for this email hasn&apos;t been created yet.
              Contact support to provision your account.
            </p>
          </div>
        ) : (
          <>
            {/* ── Explainer ── */}
            <div className="mb-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-4">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-[color:var(--muted)] mb-2">
                Why verify?
              </h2>
              <p className="text-[13px] text-[color:var(--text)] leading-relaxed">
                Verified trades appear on the main leaderboard and carry a
                badge on your profile. Without verification, your stats are
                still visible, but filtered out of verified-only views — which
                is the default for most viewers.
              </p>
              <p className="mt-2 text-[12px] text-[color:var(--muted)] leading-relaxed">
                We read your <em>order history</em> only. We never place
                trades, move funds, or access account balances.
              </p>
            </div>

            {/* ── Broker Connect card ── */}
            <BrokerConnect
              verification={trader.verification}
              brokerSource={trader.broker_source ?? undefined}
              lastSyncAt={trader.updated_at}
            />
          </>
        )}

        <p className="mt-6 font-mono text-[9px] text-[color:var(--muted)] text-center">
          Not financial advice. Past performance is not indicative of future results.
        </p>
      </main>
    </>
  );
}
