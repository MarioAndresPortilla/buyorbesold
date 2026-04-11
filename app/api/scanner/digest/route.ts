import { NextResponse } from "next/server";
import { Resend } from "resend";
import { runScanner } from "@/lib/scanner";
import { recordDigestRequest } from "@/lib/kv";
import { LIMITS, enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ScannerResult, SetupCandidate } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function renderBlock(label: string, items: SetupCandidate[], kind: "long" | "short"): string {
  const color = kind === "long" ? "#22c55e" : "#ef4444";
  if (!items.length) {
    return `<tr><td style="padding:12px 0;font-family:monospace;color:#6b7280;font-size:12px;">${label}: none matched today</td></tr>`;
  }
  const rows = items
    .map((c, i) => {
      const tags = c.tags.join(" · ");
      const url = `https://buyorbesold.vercel.app/scanner`;
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1e1e1e;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-family:monospace;color:${color};font-size:20px;font-weight:700;width:70px;">
                #${i + 1} ${c.symbol}
              </td>
              <td style="font-family:sans-serif;color:#e5e7eb;font-size:14px;">
                ${tags || "—"}
              </td>
              <td style="font-family:monospace;color:#e5e7eb;font-size:14px;text-align:right;width:90px;">
                $${c.price.toFixed(2)}
              </td>
              <td style="font-family:monospace;color:${color};font-size:13px;text-align:right;width:70px;font-weight:700;">
                ${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(2)}%
              </td>
            </tr></table>
            ${
              c.latestNews
                ? `<div style="margin-top:6px;font-family:sans-serif;font-size:12px;color:#9ca3af;">
                      <a href="${c.latestNews.url}" style="color:#c9a84c;text-decoration:none;">↗ ${c.latestNews.headline.replace(/</g, "&lt;")}</a>
                    </div>`
                : ""
            }
          </td>
        </tr>`;
    })
    .join("");
  return `<tr><td><div style="font-family:monospace;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin:16px 0 4px;">${label}</div><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

function renderDigestHtml(scan: ScannerResult): string {
  return `
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
  <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:28px;">
    <div style="font-family:monospace;font-size:10px;color:#c9a84c;text-transform:uppercase;letter-spacing:2px;">BUYORBESOLD · SCANNER DIGEST</div>
    <h1 style="font-size:26px;margin:8px 0 4px;color:#e5e7eb;">Today's setups</h1>
    <div style="font-family:monospace;font-size:11px;color:#9ca3af;">
      Scanned ${scan.candidateCount} tickers · ${scan.qualifiedCount} qualified · ${new Date(scan.scannedAt).toUTCString()}
    </div>
    ${scan.degraded ? `<div style="margin-top:12px;padding:10px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.1);color:#fbbf24;font-family:monospace;font-size:11px;border-radius:6px;">Degraded mode — float filter disabled (no FINNHUB_API_KEY)</div>` : ""}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${renderBlock("Top 3 Longs", scan.topLongs, "long")}
      ${renderBlock("Top 3 Shorts", scan.topShorts, "short")}
    </table>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1e1e1e;">
      <a href="https://buyorbesold.vercel.app/scanner" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#c9a84c;color:#0a0a0a;font-family:monospace;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">
        Open live scanner →
      </a>
    </div>
    <p style="margin-top:20px;font-family:monospace;font-size:10px;color:#6b7280;font-style:italic;">
      Not financial advice. Do your own research. This is a pattern scanner, not a recommendation.
    </p>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await enforceRateLimit(`digest:${ip}`, LIMITS.digest);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many digest requests from this address." },
        { status: 429, headers: { "Retry-After": String(rl.resetIn) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    // Soft rate limit: 1 digest per email per 24h (requires KV).
    const rate = await recordDigestRequest(email);
    if (!rate.ok) {
      return NextResponse.json(
        { error: rate.reason ?? "Too many requests." },
        { status: 429 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "mario@buyorbesold.com";
    if (!apiKey) {
      console.warn("[/api/scanner/digest] RESEND_API_KEY not set");
      return NextResponse.json({ success: true, dev: true });
    }

    const scan = await runScanner();
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: `Scanner digest · ${scan.topLongs.length + scan.topShorts.length} setups today`,
      html: renderDigestHtml(scan),
    });

    if (error) {
      console.error("[/api/scanner/digest] resend error:", error);
      return NextResponse.json(
        { error: "Could not send digest." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      longs: scan.topLongs.length,
      shorts: scan.topShorts.length,
    });
  } catch (err) {
    console.error("[/api/scanner/digest] fatal:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
