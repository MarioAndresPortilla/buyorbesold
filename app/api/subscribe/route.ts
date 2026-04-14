import { NextResponse } from "next/server";
import { Resend } from "resend";
import { addSubscriber } from "@/lib/kv";
import { LIMITS, enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const welcomeHtml = (siteUrl: string) => `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background:#0b0d11; color:#e9ecf2; margin:0; padding:32px;">
    <div style="max-width:560px; margin:0 auto; background:#111; border:1px solid #262b36; border-radius:12px; padding:32px;">
      <h1 style="font-size:22px; color:#d4a84a; margin:0 0 12px;">You're in.</h1>
      <p style="font-size:16px; line-height:1.6; margin:0 0 16px;">
        The BuyOrBeSold daily brief hits your inbox tomorrow morning. Markets, bullion, bitcoin — no noise, no pumping, no affiliate-link nonsense. Just what I'm watching and why.
      </p>
      <p style="font-size:16px; line-height:1.6; margin:0 0 16px;">
        Expect one email per weekday. You can unsubscribe any time with the link at the bottom of each brief.
      </p>
      <p style="font-size:14px; line-height:1.6; color:#8d94a3; margin:24px 0 0; border-top:1px solid #262b36; padding-top:16px;">
        — Mario<br />
        <a href="${siteUrl}" style="color:#d4a84a; text-decoration:none;">buyorbesold.com</a>
      </p>
      <p style="font-size:12px; line-height:1.5; color:#5a6070; margin:24px 0 0; font-style:italic;">
        Not financial advice. Do your own research. This email contains personal opinions on publicly available market data and is not an offer to buy or sell any security.
      </p>
    </div>
  </body>
</html>
`;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await enforceRateLimit(`subscribe:${ip}`, LIMITS.subscribe);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many sign-ups from this address. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.resetIn),
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        }
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

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "mario@buyorbesold.com";
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.com";

    // Persist to our own subscriber store (fallback to Resend audience).
    // Fire-and-forget — if KV isn't up, we just rely on Resend.
    addSubscriber(email).catch((err) =>
      console.warn("[/api/subscribe] kv subscribe warn:", err)
    );

    if (!apiKey) {
      console.warn("[/api/subscribe] RESEND_API_KEY not set — skipping send");
      return NextResponse.json({ success: true, dev: true });
    }

    const resend = new Resend(apiKey);

    if (audienceId) {
      await resend.contacts
        .create({ email, audienceId, unsubscribed: false })
        .catch((err: unknown) => {
          // Duplicate-contact errors should not block the welcome email.
          console.warn("[/api/subscribe] contacts.create warn:", err);
        });
    }

    const { error } = await resend.emails.send({
      from,
      replyTo: "support@bluemintstudios.com",
      to: email,
      subject: "You're in. The brief hits tomorrow morning.",
      html: welcomeHtml(siteUrl),
    });

    if (error) {
      console.error("[/api/subscribe] resend error:", error);
      return NextResponse.json(
        { error: "Could not send welcome email. Try again in a moment." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/subscribe] fatal:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
