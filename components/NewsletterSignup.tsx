"use client";

import { useState } from "react";

interface NewsletterSignupProps {
  variant?: "card" | "inline";
  heading?: string;
  sub?: string;
}

type Status = "idle" | "submitting" | "success" | "error";

export default function NewsletterSignup({
  variant = "card",
  heading = "Get the daily brief",
  sub = "One email each weekday. Markets, bullion, bitcoin. No spam, no pumps.",
}: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not subscribe. Try again.");
        return;
      }
      setStatus("success");
      setMessage("You're in. Check your inbox for the welcome email.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  const card = variant === "card";

  return (
    <div
      className={
        card
          ? "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
          : ""
      }
    >
      {card && (
        <>
          <h3 className="font-bebas text-2xl tracking-wide text-[color:var(--text)]">
            {heading}
          </h3>
          <p className="mt-1 text-[13px] text-[color:var(--muted)]">{sub}</p>
        </>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-md border border-[color:var(--border)] bg-black/20 px-3 py-2.5 font-mono text-sm text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none"
          disabled={status === "submitting"}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "submitting" ? "Sending…" : "Subscribe"}
        </button>
      </form>

      {message && (
        <p
          className={`mt-3 font-mono text-[11px] ${
            status === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}

      <p className="mt-3 font-mono text-[10px] italic text-[color:var(--muted)]">
        Not financial advice. Do your own research.
      </p>
    </div>
  );
}
