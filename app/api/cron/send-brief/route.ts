import { NextResponse } from "next/server";
import { Resend } from "resend";
import { signUnsubscribeToken } from "@/lib/auth";
import { getLatestBrief } from "@/lib/briefs";
import { fetchAllMarkets } from "@/lib/markets";
import { isKvAvailable, listSubscribers, markBriefSent, wasBriefSent } from "@/lib/kv";
import { EMAIL_COLORS, SITE_URL, emailShell, escape, renderMarketStrip } from "@/lib/email";
import { formatPrice } from "@/lib/format";
import type { Brief, MarketData } from "@/lib/types";

export const runtime = "nodejs";
// Hobby tier max serverless duration is 10s for Free, 60s for Pro.
// This cron makes ~16 parallel API calls + N Resend sends. 60s is plenty.
export const maxDuration = 60;

/**
 * Daily brief sender — triggered by Vercel Cron weekdays 11:00 UTC (~7am ET).
 * Also manually invokable with a CRON_SECRET bearer token.
 *
 * Flow:
 *   1. Auth: Vercel sends `Authorization: Bearer $CRON_SECRET`. We reject
 *      anything else to prevent random GETs from triggering a send.
 *   2. Idempotency: check KV for `newsletter:sent:${slug}`. If already sent,
 *      return 200 with `{skipped:true}` — safe to retry.
 *   3. Pull: latest brief + MarketData (home, BTC, gold, silver, crude, etc).
 *   4. Render: dark-theme HTML via lib/email shell.
 *   5. Send: iterate subscribers with 500ms delay (Resend 2/sec free tier).
 *   6. Mark sent in KV on success.
 *
 * Graceful fallback: if RESEND_API_KEY is missing, returns dev dry-run with
 * the rendered HTML for inspection. If KV isn't provisioned, skips
 * idempotency and uses RESEND_AUDIENCE_ID subscribers list via the Resend
 * contacts API.
 */

interface SendResult {
  ok: boolean;
  recipients: number;
  skipped: boolean;
  reason?: string;
  dryRun?: boolean;
  sample?: string; // first 2000 chars of HTML in dry-run mode
}

function renderBriefEmail(
  brief: Brief,
  market: MarketData,
  unsubscribeUrl: string
): string {
  const strip = renderMarketStrip([
    {
      label: "S&P 500",
      price: formatPrice(market.sp500.price, { currency: false }),
      changePct: market.sp500.changePct,
    },
    {
      label: "BTC",
      price: formatPrice(market.bitcoin.price),
      changePct: market.bitcoin.changePct,
    },
    {
      label: "Gold",
      price: formatPrice(market.gold.price),
      changePct: market.gold.changePct,
    },
    {
      label: "Silver",
      price: formatPrice(market.silver.price),
      changePct: market.silver.changePct,
    },
  ]);

  const fngColor =
    market.fearGreed.score < 25
      ? EMAIL_COLORS.down
      : market.fearGreed.score < 55
        ? EMAIL_COLORS.accent
        : EMAIL_COLORS.up;

  const body = `
    <!-- Pill -->
    <div style="display:inline-block;padding:4px 12px;border:1px solid rgba(201,168,76,0.4);background:rgba(201,168,76,0.12);border-radius:999px;font-family:monospace;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${EMAIL_COLORS.accent};">
      Daily Brief · ${escape(brief.date)}
    </div>

    <!-- Title -->
    <h1 style="margin:12px 0 12px;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;line-height:1.1;letter-spacing:0.5px;color:${EMAIL_COLORS.text};">
      ${escape(brief.title)}
    </h1>

    <!-- Summary -->
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${EMAIL_COLORS.muted};">
      ${escape(brief.summary)}
    </p>

    <!-- Market strip -->
    ${strip}

    <!-- Mario's take -->
    <div style="margin:20px 0 0;padding:16px 18px;border:1px solid ${EMAIL_COLORS.border};border-radius:8px;background:rgba(0,0,0,0.25);">
      <div style="font-family:monospace;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${EMAIL_COLORS.accent};margin-bottom:8px;">
        Mario's take
      </div>
      <p style="margin:0;font-size:14px;line-height:1.65;color:${EMAIL_COLORS.text};">
        ${escape(brief.take)}
      </p>
    </div>

    <!-- Fear & Greed -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
      <tr>
        <td style="padding:12px 14px;border:1px solid ${EMAIL_COLORS.border};border-radius:8px;background:rgba(0,0,0,0.2);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-family:monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">
                  Fear &amp; Greed Index
                </div>
                <div style="font-size:14px;color:${EMAIL_COLORS.text};margin-top:2px;">
                  ${escape(market.fearGreed.label)}
                </div>
              </td>
              <td align="right">
                <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;line-height:1;color:${fngColor};">
                  ${market.fearGreed.score}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return emailShell({
    preheader: `${brief.title} — ${brief.summary.slice(0, 100)}`,
    bodyHtml: body,
    ctaText: "Read the full brief",
    ctaHref: `${SITE_URL}/briefings/${brief.slug}`,
    unsubscribeUrl,
  });
}

async function gatherRecipients(resend: Resend | null): Promise<string[]> {
  // Priority: KV subscribers (local source of truth) → Resend audience fallback.
  const kvSubs = await listSubscribers();
  if (kvSubs.length > 0) return kvSubs;

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (resend && audienceId) {
    try {
      const { data } = await resend.contacts.list({ audienceId });
      if (data?.data) {
        return data.data
          .filter((c) => !c.unsubscribed && c.email)
          .map((c) => c.email!);
      }
    } catch (err) {
      console.warn("[cron/send-brief] Resend audience list fail:", err);
    }
  }
  return [];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: Request) {
  // 1. Auth
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    // If CRON_SECRET isn't set, still require a dev-only header to prevent
    // random internet traffic from triggering sends.
    const url = new URL(req.url);
    if (!url.searchParams.has("force")) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }
  }

  try {
    const brief = getLatestBrief();

    // 2. Idempotency — skip if already sent today.
    if (await wasBriefSent(brief.slug)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "brief already sent",
        slug: brief.slug,
      });
    }

    // 3. Pull market data (for the in-email snapshot).
    const market = await fetchAllMarkets();

    // 4. Send
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "mario@buyorbesold.com";
    const resend = resendKey ? new Resend(resendKey) : null;

    const recipients = await gatherRecipients(resend);

    if (!resend) {
      // Dev dry-run: don't send, just show what would have happened.
      // Render with a placeholder unsub URL.
      const html = renderBriefEmail(brief, market, `${SITE_URL}/api/unsubscribe?token=dev`);
      const result: SendResult = {
        ok: true,
        recipients: recipients.length,
        skipped: false,
        dryRun: true,
        sample: html.slice(0, 2000),
      };
      return NextResponse.json(result);
    }

    if (recipients.length === 0) {
      return NextResponse.json({
        ok: true,
        recipients: 0,
        skipped: false,
        reason: "no subscribers",
      });
    }

    const subject = `${brief.title} · BuyOrBeSold`;
    let successes = 0;
    const errors: string[] = [];

    for (const [i, email] of recipients.entries()) {
      try {
        // Per-recipient unsubscribe token: signs the individual email so the
        // one-click link in their copy only removes THEIR address, not anyone
        // else's. Signed JWT = can't be forged.
        const unsubToken = await signUnsubscribeToken(email);
        const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
        const html = renderBriefEmail(brief, market, unsubscribeUrl);

        const { error } = await resend.emails.send({
          from,
          to: email,
          subject,
          html,
          // RFC 8058 one-click unsubscribe — Gmail + others use this for the
          // native "Unsubscribe" button at the top of the message.
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${from}?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (error) {
          errors.push(`${email}: ${error.message ?? "unknown"}`);
        } else {
          successes++;
        }
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : "send error"}`);
      }
      // Resend free: 2 sends/sec. 600ms delay is comfortably under.
      if (i < recipients.length - 1) await sleep(600);
    }

    // 6. Mark sent so retries are no-ops.
    if (successes > 0) {
      await markBriefSent(brief.slug, successes);
    }

    return NextResponse.json({
      ok: true,
      recipients: successes,
      failed: errors.length,
      errors: errors.slice(0, 5), // cap in response
      slug: brief.slug,
      kvAvailable: isKvAvailable(),
    });
  } catch (err) {
    console.error("[cron/send-brief] fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "send failed" },
      { status: 500 }
    );
  }
}
