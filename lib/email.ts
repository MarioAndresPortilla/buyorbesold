/**
 * Shared HTML email template helpers for BuyOrBeSold emails.
 *
 * Email clients are hostile — only use table layouts, inline styles, and
 * avoid anything fancy (flexbox, grid, CSS variables). Colors are hardcoded
 * from the site's dark theme.
 */

export const EMAIL_COLORS = {
  bg: "#0a0a0a",
  surface: "#111111",
  border: "#1e1e1e",
  text: "#e5e7eb",
  muted: "#9ca3af",
  subtle: "#6b7280",
  accent: "#c9a84c",
  up: "#22c55e",
  down: "#ef4444",
} as const;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.vercel.app";

export function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wraps body content in the standard BuyOrBeSold email chrome: header with
 * logo, full-bleed dark background, disclaimer footer, and (when provided)
 * a CAN-SPAM-compliant unsubscribe link.
 */
export function emailShell({
  preheader,
  bodyHtml,
  ctaText,
  ctaHref,
  unsubscribeUrl,
}: {
  preheader: string;
  bodyHtml: string;
  ctaText?: string;
  ctaHref?: string;
  /** Signed unsubscribe URL. Required for bulk newsletter sends. */
  unsubscribeUrl?: string;
}): string {
  const cta =
    ctaText && ctaHref
      ? `<div style="margin-top:24px;text-align:center;">
            <a href="${ctaHref}" style="display:inline-block;padding:12px 22px;background:${EMAIL_COLORS.accent};color:#0a0a0a;font-family:monospace;font-size:11px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:1px;text-transform:uppercase;">
              ${escape(ctaText)} →
            </a>
          </div>`
      : "";

  const unsubLine = unsubscribeUrl
    ? `<p style="margin:8px 0 0;font-family:monospace;font-size:10px;color:${EMAIL_COLORS.subtle};text-align:center;">
          Don't want these? <a href="${unsubscribeUrl}" style="color:${EMAIL_COLORS.muted};text-decoration:underline;">Unsubscribe</a>
        </p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BuyOrBeSold</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${EMAIL_COLORS.text};">
    <div style="display:none;font-size:1px;color:${EMAIL_COLORS.bg};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${escape(preheader)}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_COLORS.bg};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${EMAIL_COLORS.surface};border:1px solid ${EMAIL_COLORS.border};border-radius:12px;overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="padding:24px 28px 16px;border-bottom:1px solid ${EMAIL_COLORS.border};">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle">
                      <span style="display:inline-block;width:32px;height:32px;border:2px solid ${EMAIL_COLORS.accent};background:rgba(201,168,76,0.12);border-radius:6px;color:${EMAIL_COLORS.accent};font-family:'Bebas Neue',Impact,sans-serif;font-size:16px;font-weight:700;text-align:center;line-height:30px;letter-spacing:1px;">B/S</span>
                    </td>
                    <td valign="middle" style="padding-left:12px;">
                      <div style="font-size:18px;font-weight:700;letter-spacing:2px;color:${EMAIL_COLORS.text};">BUYORBESOLD</div>
                      <div style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${EMAIL_COLORS.muted};margin-top:2px;">Markets · Bullion · Bitcoin</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 28px;">
                ${bodyHtml}
                ${cta}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 28px 24px;border-top:1px solid ${EMAIL_COLORS.border};">
                <p style="margin:0 0 8px;font-family:monospace;font-size:10px;color:${EMAIL_COLORS.muted};letter-spacing:1.5px;text-transform:uppercase;text-align:center;">
                  <a href="${SITE_URL}/dashboard" style="color:${EMAIL_COLORS.muted};text-decoration:none;">Dashboard</a>
                  &nbsp;·&nbsp;
                  <a href="${SITE_URL}/scanner" style="color:${EMAIL_COLORS.muted};text-decoration:none;">Scanner</a>
                  &nbsp;·&nbsp;
                  <a href="${SITE_URL}/journal" style="color:${EMAIL_COLORS.muted};text-decoration:none;">Journal</a>
                  &nbsp;·&nbsp;
                  <a href="${SITE_URL}/briefings" style="color:${EMAIL_COLORS.muted};text-decoration:none;">Archive</a>
                </p>
                <p style="margin:12px 0 0;font-family:monospace;font-size:10px;color:${EMAIL_COLORS.subtle};font-style:italic;text-align:center;line-height:1.5;">
                  Not financial advice. Do your own research. This email contains<br/>
                  personal opinions on publicly available market data.
                </p>
                ${unsubLine}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Renders a compact 4-column ticker strip for use inside emails.
 */
export function renderMarketStrip(tickers: Array<{ label: string; price: string; changePct: number }>): string {
  const cells = tickers
    .map((t) => {
      const color = t.changePct >= 0 ? EMAIL_COLORS.up : EMAIL_COLORS.down;
      const sign = t.changePct >= 0 ? "+" : "";
      return `<td align="center" valign="top" style="padding:12px 6px;width:25%;">
          <div style="font-family:monospace;font-size:9px;color:${EMAIL_COLORS.muted};letter-spacing:1.5px;text-transform:uppercase;">${escape(t.label)}</div>
          <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;font-weight:700;color:${EMAIL_COLORS.text};margin-top:2px;">${escape(t.price)}</div>
          <div style="font-family:monospace;font-size:11px;font-weight:700;color:${color};margin-top:2px;">${sign}${t.changePct.toFixed(2)}%</div>
        </td>`;
    })
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${EMAIL_COLORS.border};border-radius:8px;background:rgba(0,0,0,0.2);margin:20px 0;">
    <tr>${cells}</tr>
  </table>`;
}
