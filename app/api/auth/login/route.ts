import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getAdminEmail,
  isAuthConfigured,
  signMagicLinkToken,
} from "@/lib/auth";
import { LIMITS, enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.vercel.app";

function magicEmailHtml(link: string): string {
  return `
<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e5e7eb;margin:0;padding:32px;">
    <div style="max-width:520px;margin:0 auto;background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:32px;">
      <div style="font-family:monospace;font-size:10px;color:#c9a84c;text-transform:uppercase;letter-spacing:2px;">BUYORBESOLD · ADMIN</div>
      <h1 style="font-size:24px;margin:8px 0 12px;color:#e5e7eb;">Sign in to the trading journal</h1>
      <p style="font-size:14px;line-height:1.6;color:#9ca3af;margin:0 0 20px;">
        Click the button below to sign in. The link expires in 15 minutes.
      </p>
      <a href="${link}" style="display:inline-block;padding:12px 20px;background:#c9a84c;color:#0a0a0a;font-family:monospace;font-size:12px;font-weight:700;text-decoration:none;border-radius:6px;text-transform:uppercase;letter-spacing:1px;">
        Sign in →
      </a>
      <p style="font-size:12px;color:#6b7280;margin:24px 0 0;word-break:break-all;">
        Or paste this URL: <br/>
        <span style="color:#9ca3af;">${link}</span>
      </p>
      <p style="font-size:11px;font-style:italic;color:#6b7280;margin:24px 0 0;border-top:1px solid #1e1e1e;padding-top:16px;">
        If you didn't request this, ignore this email. Only the admin address can successfully sign in.
      </p>
    </div>
  </body>
</html>`;
}

export async function POST(req: Request) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json(
        { error: "Auth is not configured on this deployment." },
        { status: 500 }
      );
    }

    const ip = getClientIp(req);
    const rl = await enforceRateLimit(`login:${ip}`, LIMITS.login);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.resetIn),
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

    const admin = getAdminEmail();
    // Quietly accept any email but only send a real link if it's the admin.
    // This avoids leaking which email is the admin to probers.
    if (admin !== email) {
      return NextResponse.json({ success: true });
    }

    const token = await signMagicLinkToken(email);
    const link = `${SITE_URL}/api/auth/callback?token=${encodeURIComponent(token)}`;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.warn("[auth/login] RESEND_API_KEY not set — printing magic link to logs:");
      console.warn(link);
      // Only return the link in the response when running locally. In
      // production we refuse so a leaked API key can't be turned into a
      // magic-link generator.
      const isLocal = process.env.NODE_ENV !== "production";
      return NextResponse.json({
        success: true,
        dev: true,
        ...(isLocal ? { link } : {}),
      });
    }

    const from = process.env.RESEND_FROM_EMAIL ?? "mario@buyorbesold.com";
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Your sign-in link — BuyOrBeSold",
      html: magicEmailHtml(link),
    });

    if (error) {
      console.error("[auth/login] resend error:", error);
      return NextResponse.json(
        { error: "Could not send magic link." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auth/login] fatal:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
