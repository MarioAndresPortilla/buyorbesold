"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--bg)] px-4 text-center text-[color:var(--text)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10">
        <span className="text-3xl">!</span>
      </div>
      <h1 className="font-bebas text-4xl tracking-wide">Something broke</h1>
      <p className="max-w-md text-[14px] leading-relaxed text-[color:var(--muted)]">
        {error.message || "An unexpected error occurred."}
        {error.digest && (
          <span className="mt-1 block font-mono text-[10px] text-[color:var(--muted)]/60">
            digest: {error.digest}
          </span>
        )}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-[color:var(--border)] px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--text)] hover:border-[color:var(--accent)]"
        >
          Go home
        </Link>
      </div>
      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
        Not financial advice. Do your own research.
      </p>
    </div>
  );
}
