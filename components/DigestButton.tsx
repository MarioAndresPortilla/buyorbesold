"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function DigestButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/scanner/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not send. Try again.");
        return;
      }
      setStatus("success");
      setMessage("Sent. Check your inbox.");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
      >
        ✉ Email me today's digest
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3 sm:flex-row sm:items-center"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="flex-1 rounded-md border border-[color:var(--border)] bg-black/20 px-3 py-2 font-mono text-xs text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none"
        disabled={status === "submitting" || status === "success"}
      />
      <button
        type="submit"
        disabled={status === "submitting" || status === "success"}
        className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "submitting" ? "Sending…" : status === "success" ? "Sent" : "Send"}
      </button>
      {message && (
        <span
          className={`font-mono text-[10px] ${
            status === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </span>
      )}
    </form>
  );
}
