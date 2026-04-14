"use client";

import { useState } from "react";

interface LoginFormProps {
  disabled?: boolean;
}

type Status = "idle" | "submitting" | "sent" | "error";

export default function LoginForm({ disabled = false }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not send link.");
        return;
      }
      setStatus("sent");
      setMessage(
        "If that email is authorized, a sign-in link is on its way. Check your inbox."
      );
      if (data.dev && data.link) {
        setDevLink(data.link);
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={disabled || status === "submitting" || status === "sent"}
          className="rounded-md border border-[color:var(--border)] bg-black/20 px-3 py-2.5 font-mono text-sm text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || status === "submitting" || status === "sent"}
          className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "submitting"
            ? "Sending…"
            : status === "sent"
              ? "Sent"
              : "Send magic link"}
        </button>
      </form>

      {message && (
        <p
          className={`mt-4 font-mono text-[11px] ${
            status === "sent"
              ? "text-emerald-400"
              : status === "error"
                ? "text-red-400"
                : "text-[color:var(--muted)]"
          }`}
        >
          {message}
        </p>
      )}

      {devLink && (
        <div className="mt-4 rounded-md border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 p-3 font-mono text-[10px] text-[color:var(--accent)]">
          <div className="mb-1 font-bold uppercase tracking-wider">Dev mode</div>
          <div className="break-all text-[color:var(--text)]">{devLink}</div>
          <div className="mt-1 text-[color:var(--muted)]">
            RESEND_API_KEY not set — link is returned directly for local testing.
          </div>
        </div>
      )}
    </div>
  );
}
