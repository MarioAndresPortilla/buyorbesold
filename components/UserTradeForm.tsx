"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const SETUP_OPTIONS = [
  { value: "sma-bounce", label: "SMA bounce" },
  { value: "breakout", label: "Breakout" },
  { value: "catalyst", label: "Catalyst / PR" },
  { value: "reversal", label: "Reversal" },
  { value: "other", label: "Other" },
];

export default function UserTradeForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"long" | "short">("long");
  const [setupType, setSetupType] = useState("sma-bounce");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryPrice, setEntryPrice] = useState("");
  const [size, setSize] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [thesis, setThesis] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    const tags = tagsInput.split(/[,\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 10);
    try {
      const res = await fetch("/api/my-journal/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol, side, setupType, entryDate, entryPrice, size,
          stop: stop || undefined, target: target || undefined,
          exitDate: exitDate || undefined, exitPrice: exitPrice || undefined,
          thesis, tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus("error"); setMessage(data.error ?? "Could not save."); return; }
      setStatus("success");
      setMessage("Trade saved.");
      setTimeout(() => { router.push("/my-journal"); router.refresh(); }, 600);
    } catch {
      setStatus("error");
      setMessage("Network error.");
    }
  }

  const inputCls = "w-full rounded-md border border-[color:var(--border)] bg-black/20 px-3 py-2.5 font-mono text-sm text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 xs:p-6">
      <div className="grid gap-4 xs:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Symbol <span className="text-[color:var(--accent)]">*</span></span>
          <input type="text" required value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Side <span className="text-[color:var(--accent)]">*</span></span>
          <div className="flex gap-2">
            {(["long", "short"] as const).map(s => (
              <button key={s} type="button" onClick={() => setSide(s)} className="flex-1 rounded-md border px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] transition-colors"
                style={side === s ? { borderColor: s === "long" ? "var(--up)" : "var(--down)", background: `color-mix(in oklab, ${s === "long" ? "var(--up)" : "var(--down)"} 20%, transparent)`, color: s === "long" ? "var(--up)" : "var(--down)" } : { borderColor: "var(--border)", color: "var(--muted)" }}>
                {s}
              </button>
            ))}
          </div>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Setup type <span className="text-[color:var(--accent)]">*</span></span>
        <select value={setupType} onChange={e => setSetupType(e.target.value)} className={inputCls}>
          {SETUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>

      <div className="grid gap-4 xs:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Entry date <span className="text-[color:var(--accent)]">*</span></span>
          <input type="date" required value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Entry price <span className="text-[color:var(--accent)]">*</span></span>
          <input type="number" step="0.01" required value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="12.50" className={inputCls} />
        </label>
      </div>

      <div className="grid gap-4 xs:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Size (shares) <span className="text-[color:var(--accent)]">*</span></span>
          <input type="number" step="1" required value={size} onChange={e => setSize(e.target.value)} placeholder="500" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Stop</span>
          <input type="number" step="0.01" value={stop} onChange={e => setStop(e.target.value)} placeholder="11.80" className={inputCls} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Target</span>
        <input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="14.00" className={inputCls} />
      </label>

      <div className="border-t border-[color:var(--border)] pt-5">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Exit (optional)</div>
        <div className="grid gap-4 xs:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Exit date</span>
            <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Exit price</span>
            <input type="number" step="0.01" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="13.80" className={inputCls} />
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Thesis <span className="text-[color:var(--accent)]">*</span></span>
        <textarea required rows={4} maxLength={2000} value={thesis} onChange={e => setThesis(e.target.value)} placeholder="What setup, what catalyst, what invalidates it." className={`${inputCls} resize-y`} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Tags (comma separated)</span>
        <input type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="low-float, catalyst" className={inputCls} />
      </label>

      <div className="flex items-center gap-3 border-t border-[color:var(--border)] pt-5">
        <button type="submit" disabled={status === "submitting" || status === "success"} className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90 disabled:opacity-50">
          {status === "submitting" ? "Saving…" : status === "success" ? "Saved ✓" : "Save trade"}
        </button>
        {message && <p className={`font-mono text-[11px] ${status === "success" ? "text-emerald-400" : "text-red-400"}`}>{message}</p>}
      </div>
    </form>
  );
}
