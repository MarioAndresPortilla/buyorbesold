import { NextResponse } from "next/server";
import { isAuthConfigured, verifyToken } from "@/lib/auth";
import { removeSubscriber } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * One-click CAN-SPAM unsubscribe.
 * Accepts a signed token from the email footer. No login required.
 * Returns a simple HTML confirmation page so the user has feedback even if
 * their mail client opens the link in a basic browser.
 */

function page(body: string): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Unsubscribe — BuyOrBeSold</title>
    <style>
      body {
        margin: 0;
        padding: 48px 20px;
        background: #0b0d11;
        color: #e9ecf2;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        line-height: 1.55;
      }
      .card {
        max-width: 480px;
        margin: 0 auto;
        background: #111;
        border: 1px solid #262b36;
        border-radius: 12px;
        padding: 32px;
      }
      h1 { font-size: 22px; color: #d4a84a; margin: 0 0 12px; }
      p { color: #8d94a3; font-size: 14px; }
      a { color: #d4a84a; }
      .small { font-size: 11px; color: #5a6070; font-style: italic; margin-top: 24px; border-top: 1px solid #262b36; padding-top: 16px; }
    </style>
  </head>
  <body><div class="card">${body}</div></body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

async function handleUnsubscribe(token: string | null): Promise<Response> {
  if (!token) {
    return page(
      `<h1>Missing token</h1><p>This unsubscribe link is incomplete. If you keep getting emails, reply to any of them and we'll remove you manually.</p>`
    );
  }
  if (!isAuthConfigured()) {
    return page(
      `<h1>Unsubscribe temporarily unavailable</h1><p>Auth is not configured on this deployment. Reply to any email and we'll remove you.</p>`
    );
  }
  const claims = await verifyToken(token);
  if (!claims) {
    return page(
      `<h1>Invalid or expired link</h1><p>This unsubscribe link can't be verified. Reply to any email and we'll remove you manually.</p>`
    );
  }
  await removeSubscriber(claims.sub);
  return page(
    `<h1>You're unsubscribed</h1>
     <p><strong>${claims.sub}</strong> has been removed from the BuyOrBeSold daily brief list.</p>
     <p>You won't receive any more emails. If this was a mistake, you can <a href="/newsletter">resubscribe anytime</a>.</p>
     <p class="small">Not financial advice. Do your own research.</p>`
  );
}

// GET + POST both work (some email clients send POST for "List-Unsubscribe=One-Click").
export async function GET(req: Request) {
  const url = new URL(req.url);
  return handleUnsubscribe(url.searchParams.get("token"));
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get("token");
  if (!token) {
    try {
      const body = (await req.json()) as { token?: string };
      token = body.token ?? null;
    } catch {
      // ignore
    }
  }
  return handleUnsubscribe(token);
}
