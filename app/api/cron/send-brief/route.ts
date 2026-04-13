import { NextResponse } from "next/server";
import { Resend } from "resend";
import { signUnsubscribeToken } from "@/lib/auth";
import { getLatestBrief } from "@/lib/briefs";
import { generateBrief, type BriefEdition } from "@/lib/ai-brief";
import { fetchAllMarkets } from "@/lib/markets";
import { runScanner } from "@/lib/scanner";
import {
  isKvAvailable,
  listSubscribers,
  markBriefSent,
  saveAiBrief,
  wasBriefSent,
  wasAiBriefSent,
  markAiBriefSent,
} from "@/lib/kv";
import { EMAIL_COLORS, SITE_URL, emailShell, escape, renderMarketStrip } from "@/lib/email";
import { formatPrice } from "@/lib/format";
import type { Brief, MarketData } from "@/lib/types";

export const runtime = "nodejs";
// Pro tier: 300s max. AI generation + market fetch + email sends need headroom.
export const maxDuration = 120;

const VALID_EDITIONS = new Set<BriefEdition>(["premarket", "midday", "postmarket"]);

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
  edition?: string;
  useAi?: boolean;
  sample?: string;
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

  const stockFngColor =
    market.fearGreed.stock.score < 25
      ? EMAIL_COLORS.down
      : market.fearGreed.stock.score < 55
        ? EMAIL_COLORS.accent
        : EMAIL_COLORS.up;

  const cryptoFngColor =
    market.fearGreed.crypto.score < 25
      ? EMAIL_COLORS.down
      : market.fearGreed.crypto.score < 55
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

    <!-- Fear & Greed (dual) -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
      <tr>
        <td style="padding:12px 14px;border:1px solid ${EMAIL_COLORS.border};border-radius:8px;background:rgba(0,0,0,0.2);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-family:monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">
                  Stock Market Fear &amp; Greed
                </div>
                <div style="font-size:14px;color:${EMAIL_COLORS.text};margin-top:2px;">
                  ${escape(market.fearGreed.stock.label)}
                </div>
              </td>
              <td align="right">
                <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;line-height:1;color:${stockFngColor};">
                  ${market.fearGreed.stock.score}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px 14px;border:1px solid ${EMAIL_COLORS.border};border-radius:8px;background:rgba(0,0,0,0.2);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-family:monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">
                  Crypto Fear &amp; Greed
                </div>
                <div style="font-size:14px;color:${EMAIL_COLORS.text};margin-top:2px;">
                  ${escape(market.fearGreed.crypto.label)}
                </div>
              </td>
              <td align="right">
                <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;line-height:1;color:${cryptoFngColor};">
                  ${market.fearGreed.crypto.score}
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
    const u = new URL(req.url);
    if (!u.searchParams.has("force")) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }
  }

  try {
    const u = new URL(req.url);
    const editionParam = u.searchParams.get("edition") as BriefEdition | null;
    const useAi =
      editionParam &&
      VALID_EDITIONS.has(editionParam) &&
      !!process.env.ANTHROPIC_API_KEY;
    const edition: BriefEdition =
      editionParam && VALID_EDITIONS.has(editionParam) ? editionParam : "premarket";

    // 2. Pull market data (used for AI generation AND email snapshot).
    const market = await fetchAllMarkets();

    // 3. Resolve the brief — AI-generated or latest filesystem.
    let brief: Brief;

    if (useAi) {
      const aiSlug = `${new Date().toISOString().slice(0, 10)}-${edition}`;
      if (await wasAiBriefSent(aiSlug)) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: `AI ${edition} brief already sent today`,
          slug: aiSlug,
        });
      }
      const scanner = await runScanner().catch(() => ({
        topLongs: [],
        topShorts: [],
        scannedAt: new Date().toISOString(),
        candidateCount: 0,
        qualifiedCount: 0,
        degraded: true,
        notes: ["scanner unavailable"],
        criteria: {
          priceMin: 1,
          priceMax: 20,
          maxFloat: 20_000_000,
          minRvol: 1.5,
          smaBouncePct: 0.02,
        },
      }));
      brief = await generateBrief(edition, market, scanner);
      await saveAiBrief(brief);
    } else {
      brief = getLatestBrief();
      if (await wasBriefSent(brief.slug)) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "brief already sent",
          slug: brief.slug,
        });
      }
    }

    // 4. Send
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "mario@buyorbesold.com";
    const resend = resendKey ? new Resend(resendKey) : null;
    const recipients = await gatherRecipients(resend);

    if (!resend) {
      const html = renderBriefEmail(
        brief,
        market,
        `${SITE_URL}/api/unsubscribe?token=dev`
      );
      return NextResponse.json({
        ok: true,
        recipients: recipients.length,
        skipped: false,
        dryRun: true,
        edition,
        useAi: !!useAi,
        sample: html.slice(0, 2000),
      } satisfies SendResult);
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
        const unsubToken = await signUnsubscribeToken(email);
        const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
        const html = renderBriefEmail(brief, market, unsubscribeUrl);

        const { error } = await resend.emails.send({
          from,
          replyTo: "support@bluemintstudios.com",
          to: email,
          subject,
          html,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${from}?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (error) errors.push(`${email}: ${error.message ?? "unknown"}`);
        else successes++;
      } catch (err) {
        errors.push(
          `${email}: ${err instanceof Error ? err.message : "send error"}`
        );
      }
      if (i < recipients.length - 1) await sleep(600);
    }

    // 5. Mark sent so retries are idempotent.
    if (successes > 0) {
      if (useAi) {
        await markAiBriefSent(brief.slug, successes);
      } else {
        await markBriefSent(brief.slug, successes);
      }
    }

    return NextResponse.json({
      ok: true,
      recipients: successes,
      failed: errors.length,
      errors: errors.slice(0, 5),
      slug: brief.slug,
      edition,
      useAi: !!useAi,
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
