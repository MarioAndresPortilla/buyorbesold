import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import { isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in",
  description: "Admin sign-in for the BuyOrBeSold trading journal.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Missing magic link token.",
  invalid: "That link is invalid or expired. Request a new one.",
  forbidden: "That email is not authorized.",
  notconfigured: "Auth is not configured on this deployment.",
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { error: errorKey } = await searchParams;
  const error = errorKey ? ERROR_MESSAGES[errorKey] : null;
  const configured = isAuthConfigured();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-[620px] items-center justify-between gap-2 px-3 py-3 xs:px-4 xs:py-4">
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
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)] hover:text-[color:var(--accent)] xs:text-[11px] xs:tracking-[0.15em]"
          >
            Journal →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 py-16">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
          Admin sign-in
        </div>
        <h1 className="mt-3 font-bebas text-5xl leading-none tracking-wide">
          Sign in to journal
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--muted)]">
          Only the admin email can create or edit journal entries. Everyone else
          can view them publicly. You'll get a one-tap magic link in your inbox
          — no password.
        </p>

        {!configured && (
          <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 font-mono text-[11px] leading-relaxed text-amber-400">
            <div className="font-bold uppercase tracking-wider">
              Auth not configured
            </div>
            <div className="mt-1">
              Set ADMIN_EMAIL and AUTH_SECRET environment variables on the
              deployment, then redeploy. Generate AUTH_SECRET with{" "}
              <code className="text-[color:var(--accent)]">openssl rand -base64 32</code>.
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 font-mono text-[11px] text-red-400">
            {error}
          </div>
        )}

        <div className="mt-8">
          <LoginForm disabled={!configured} />
        </div>

        <p className="mt-10 border-t border-[color:var(--border)] pt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Not financial advice. Do your own research.
        </p>
      </main>
    </div>
  );
}
