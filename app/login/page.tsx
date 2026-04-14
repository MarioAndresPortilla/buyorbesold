import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a free account for your private BuyOrBeSold trading journal.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Missing magic link token.",
  invalid: "That link is invalid or expired. Request a new one.",
  notconfigured: "Auth is not configured on this deployment.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "Google sign-in session expired. Try again.",
  google_failed: "Could not sign in with Google. Try again or use email.",
  google_unverified: "Your Google email isn't verified. Use email instead.",
};

function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error: errorKey } = await searchParams;
  const error = errorKey ? ERROR_MESSAGES[errorKey] : null;
  const configured = isAuthConfigured();
  const googleEnabled = configured && isGoogleConfigured();

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <SiteNav maxWidth="max-w-[620px]" />

      <main className="mx-auto max-w-[520px] px-4 py-16">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
          Free account
        </div>
        <h1 className="mt-3 font-bebas text-5xl leading-none tracking-wide">
          Start your journal
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--muted)]">
          Track every trade, see your win rate, and build your edge — all free.
          Enter your email and we'll send you a one-tap magic link. No password,
          no signup form. Just your email.
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

        <div className="mt-8 space-y-4">
          {googleEnabled && (
            <>
              <a
                href="/api/auth/google/start"
                className="flex w-full items-center justify-center gap-3 rounded-md border border-[color:var(--border)] bg-white px-4 py-3 font-mono text-sm font-semibold text-gray-900 transition-opacity hover:opacity-90"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                </svg>
                Continue with Google
              </a>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[color:var(--border)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  or
                </span>
                <div className="h-px flex-1 bg-[color:var(--border)]" />
              </div>
            </>
          )}
          <LoginForm disabled={!configured} />
        </div>

        {/* Value prop — what you get */}
        <div className="mt-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <h3 className="font-bebas text-2xl tracking-wide">What you get — free</h3>
          <ul className="mt-4 space-y-3 text-[13px] text-[color:var(--muted)]">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-[color:var(--accent)]">✦</span>
              <div>
                <span className="font-semibold text-[color:var(--text)]">Private trading journal</span> —
                log every trade with entry, exit, stop, thesis, and setup type. Track your P&L and R-multiples automatically.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-[color:var(--accent)]">✦</span>
              <div>
                <span className="font-semibold text-[color:var(--text)]">Win rate analytics</span> —
                see your real numbers: win rate, avg R, expectancy per trade, breakdown by setup type. No guessing.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-[color:var(--accent)]">✦</span>
              <div>
                <span className="font-semibold text-[color:var(--text)]">Daily scanner access</span> —
                top 3 long + top 3 short small-cap setups, filtered by float, RVOL, and SMA bounce. Updated every 5 minutes during market hours.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-[color:var(--accent)]">✦</span>
              <div>
                <span className="font-semibold text-[color:var(--text)]">3 AI briefs per day</span> —
                pre-market (9am), midday (12pm), post-market (4pm). Live market data + scanner output, written in Mario&apos;s voice.
              </div>
            </li>
          </ul>
          <p className="mt-4 font-mono text-[10px] italic text-[color:var(--muted)]">
            Your data is private. Only you can see your journal. Mario&apos;s public journal is separate.
          </p>
        </div>

        <SiteFooter minimal />
      </main>
    </div>
  );
}
