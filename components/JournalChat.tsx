"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface JournalChatProps {
  tradeCount: number;
  hasAuth: boolean;
  hasAi: boolean;
}

const STARTERS = [
  "What's my strongest setup and how statistically significant is the sample?",
  "Where am I leaking money — day, symbol, or setup?",
  "Am I over-concentrated in any one name?",
  "How does my expectancy change if I skip my worst day of the week?",
  "What does my drawdown behavior tell me about my risk management?",
];

export default function JournalChat({ tradeCount, hasAuth, hasAi }: JournalChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send(content: string) {
    const text = content.trim();
    if (!text || loading) return;
    setError(null);
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/journal/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setMessages([...next, { role: "assistant", content: String(data.reply ?? "") }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "chat failed");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  if (!hasAuth) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-8 text-center">
        <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
          Sign in required
        </div>
        <p className="mt-2 text-[13px] text-[color:var(--muted)]">
          The analyst only reads your own journal. Sign in to unlock chat.
        </p>
        <a
          href="/auth/login"
          className="mt-4 inline-block rounded-md border border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-[color:var(--accent)] hover:bg-[color:var(--accent)]/20"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (!hasAi) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-8 text-center">
        <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
          Chat not configured
        </div>
        <p className="mt-2 text-[13px] text-[color:var(--muted)]">
          Add <code className="font-mono">ANTHROPIC_API_KEY</code> to your environment to enable the analyst.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}
          />
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--text)]">
              Journal Analyst
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
              Grounded on {tradeCount} trade{tradeCount === 1 ? "" : "s"} · no market predictions
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex min-h-[400px] flex-col gap-4 overflow-y-auto px-4 py-5 sm:min-h-[500px] sm:px-6"
        style={{ maxHeight: "65vh" }}
      >
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[color:var(--border)]/60 bg-[color:var(--bg)]/60 p-4">
              <p className="text-[13px] leading-relaxed text-[color:var(--text)]">
                Ask anything about your trading history. I&apos;ll cite the exact
                numbers from your journal — win rates, R-multiples, drawdowns,
                setup performance, symbol concentration, day-of-week patterns.
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--muted)]">
                I don&apos;t predict prices or give advice. I analyze what
                you&apos;ve already done and what the data says about what
                works.
              </p>
            </div>

            {tradeCount === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
                  No trades yet
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--muted)]">
                  Log trades in the journal first — the analyst needs data to analyze.
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                  Try asking
                </div>
                <div className="flex flex-col gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={loading}
                      className="group rounded-md border border-[color:var(--border)] bg-[color:var(--bg)]/40 px-3 py-2 text-left text-[12px] leading-relaxed text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)]/40 hover:bg-[color:var(--accent)]/5 hover:text-[color:var(--text)] disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {loading && <TypingIndicator />}

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-[color:var(--border)] bg-[color:var(--bg)]/40 p-3 sm:p-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              tradeCount === 0
                ? "Log some trades first…"
                : "Ask about your trading patterns…"
            }
            rows={1}
            disabled={loading || tradeCount === 0}
            className="min-h-[40px] max-h-[160px] flex-1 resize-none rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[13px] leading-relaxed text-[color:var(--text)] placeholder:text-[color:var(--muted)]/60 focus:border-[color:var(--accent)]/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || tradeCount === 0}
            className="shrink-0 rounded-md border border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[color:var(--accent)] transition-colors hover:bg-[color:var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
        <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-[color:var(--muted)]">
          Enter to send · Shift+Enter for newline · Not financial advice
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed sm:max-w-[80%] sm:px-4 sm:py-3 ${
          isUser
            ? "bg-[color:var(--accent)]/15 text-[color:var(--text)]"
            : "border border-[color:var(--border)]/60 bg-[color:var(--bg)]/40 text-[color:var(--text)]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <AssistantBody content={message.content} />
        )}
      </div>
    </div>
  );
}

/**
 * Render assistant replies with light markdown support: paragraphs, bullets,
 * and **bold**. Intentionally minimal — the model is told to keep replies
 * in short paragraphs, not heavy formatting.
 */
function AssistantBody({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^[-*]\s+/.test(l.trim()));
        if (isList) {
          return (
            <ul key={i} className="ml-4 list-disc space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        // Italic disclaimer line treated as muted
        if (/^\*[^*]+\*$/.test(block.trim())) {
          return (
            <p
              key={i}
              className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--muted)]"
            >
              {block.replace(/^\*|\*$/g, "")}
            </p>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return (
        <strong key={i} className="font-semibold text-[color:var(--text)]">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)]/60 bg-[color:var(--bg)]/40 px-4 py-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--accent)]" />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--accent)]"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--accent)]"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
