import React from "react";

/**
 * Render a brief's body text with minimal markdown-lite support:
 *   - Double newlines separate paragraphs
 *   - Lines starting with "- ", "* ", or "• " become bullet list items
 *   - **bold** → <strong>
 *   - Headings starting with "## " become h3 (section headers)
 *
 * We intentionally avoid a heavy markdown lib — AI output + hand-written
 * briefs are plain-ish prose with occasional lists, not full markdown docs.
 */

interface BriefBodyProps {
  text: string;
  className?: string;
}

const BULLET_RE = /^(\s*[-*•]\s+)(.*)/;
const HEADING_RE = /^(#{2,3})\s+(.*)/;

export default function BriefBody({ text, className = "" }: BriefBodyProps) {
  // Split into blocks on blank lines
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className={`space-y-4 text-[14px] leading-relaxed text-[color:var(--text)] ${className}`}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

        // Entire block is a bullet list if every line looks like a bullet
        const allBullets = lines.length > 0 && lines.every((l) => BULLET_RE.test(l));
        if (allBullets) {
          return (
            <ul
              key={i}
              className="ml-1 space-y-1.5 text-[14px] leading-relaxed"
            >
              {lines.map((line, j) => {
                const m = line.match(BULLET_RE);
                return (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-[2px] text-[color:var(--accent)] select-none">▸</span>
                    <span className="flex-1">{renderInline(m?.[2] ?? line)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Heading block (single line, starts with ##)
        if (lines.length === 1) {
          const h = lines[0].match(HEADING_RE);
          if (h) {
            const level = h[1].length; // 2 or 3
            const Tag = level === 2 ? "h2" : "h3";
            return React.createElement(
              Tag,
              {
                key: i,
                className:
                  level === 2
                    ? "font-bebas text-xl tracking-wide text-[color:var(--text)] mt-2"
                    : "font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent)] mt-2",
              },
              renderInline(h[2])
            );
          }
        }

        // Default: paragraph (line breaks within a block become spaces for typography)
        const paragraphText = lines.join(" ");
        return (
          <p key={i} className="leading-[1.65]">
            {renderInline(paragraphText)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Inline renderer: handles **bold** within any text run. Splits into alternating
 * text + strong spans. Keeps it O(n) with no regex backtracking surprises.
 */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[color:var(--text)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
