"use client";

import { useEffect, useRef, useState } from "react";

interface OnboardingFormProps {
  email: string;
  suggestedUsername: string;
}

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; reason: string };

const REASON_LABELS: Record<string, string> = {
  "too-short": "Must be at least 3 characters",
  "too-long": "Must be 20 characters or fewer",
  "invalid-chars": "Only letters, numbers, hyphens, and underscores",
  "reserved": "This username is reserved",
  "taken": "Username already taken",
};

export default function OnboardingForm({ email, suggestedUsername }: OnboardingFormProps) {
  const [username, setUsername] = useState(suggestedUsername);
  const [displayName, setDisplayName] = useState(suggestedUsername);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced username availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username) {
      setCheck({ status: "idle" });
      return;
    }

    setCheck({ status: "checking" });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding?check=username&username=${encodeURIComponent(username)}`
        );
        const data = await res.json();
        if (data.available) {
          setCheck({ status: "available" });
        } else {
          setCheck({ status: "unavailable", reason: data.reason ?? "taken" });
        }
      } catch {
        setCheck({ status: "idle" });
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (check.status !== "available") {
      setError("Pick an available username first.");
      return;
    }
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), displayName: displayName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not create profile.");
        setSubmitting(false);
        return;
      }

      // Success — redirect to their new profile
      window.location.href = `/trader/${data.trader.username}`;
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email (readonly) */}
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)] block mb-1.5">
          Email
        </label>
        <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]/60 px-3 py-2 font-mono text-[13px] text-[color:var(--muted)]">
          {email}
        </div>
      </div>

      {/* Username */}
      <div>
        <label htmlFor="username" className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)] block mb-1.5">
          Username
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-[color:var(--muted)]">
            @
          </span>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] pl-7 pr-3 py-2 font-mono text-[13px] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)]"
            placeholder="your-username"
          />
        </div>
        <div className="mt-1.5 font-mono text-[11px] min-h-[16px]">
          {check.status === "checking" && (
            <span className="text-[color:var(--muted)]">Checking...</span>
          )}
          {check.status === "available" && (
            <span className="text-[color:var(--up)]">&#10003; Available</span>
          )}
          {check.status === "unavailable" && (
            <span className="text-[color:var(--down)]">
              &#10007; {REASON_LABELS[check.reason] ?? check.reason}
            </span>
          )}
        </div>
      </div>

      {/* Display name */}
      <div>
        <label htmlFor="displayName" className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--muted)] block mb-1.5">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[13px] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)]"
          placeholder="Your name"
        />
        <div className="mt-1.5 font-mono text-[10px] text-[color:var(--muted)]">
          Up to 50 characters. You can change this later.
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-[color:var(--down)]/40 bg-[color:var(--down)]/10 px-3 py-2 font-mono text-[12px] text-[color:var(--down)]">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || check.status !== "available" || !displayName.trim()}
        className="w-full rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10 px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-widest text-[color:var(--accent)] transition-colors hover:bg-[color:var(--accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Creating profile..." : "Create profile →"}
      </button>
    </form>
  );
}
