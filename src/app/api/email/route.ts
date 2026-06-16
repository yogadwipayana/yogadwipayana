import { NextResponse } from "next/server";
import { z } from "zod";

import { sendEmail } from "@/lib/email";
import { fail } from "@/lib/server/api-response";
import {
  checkRateLimit,
  getClientIp,
  ratelimits,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// Reject control characters that could be used to inject email headers.
const headerSafe = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => !/[\r\n\u0000]/.test(v), {
      message: "Control characters are not allowed",
    });

const BodySchema = z.object({
  name: headerSafe(120),
  email: z
    .email()
    .max(254)
    .refine((v) => !/[\r\n\u0000]/.test(v), {
      message: "Control characters are not allowed",
    }),
  subject: headerSafe(160).optional(),
  message: z.string().min(1).max(5_000),
  // simple honeypot for bots
  website: z.string().optional(),
});

/**
 * POST /api/email — contact form endpoint.
 * Public on purpose (no auth) so visitors can reach out. Hardened with:
 *   - honeypot
 *   - size limits + control-character rejection (header injection)
 *   - per-IP rate limit
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers) ?? "unknown";
    await checkRateLimit(ratelimits.contact, ip, "contact form");

    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { name, email, subject, message, website } = parsed.data;
    if (website && website.length > 0) {
      // honeypot tripped — silently succeed so bots don't retry
      return NextResponse.json({ ok: true });
    }

    const to = process.env.CONTACT_TO_EMAIL;
    if (!to) {
      return NextResponse.json(
        { error: "Contact endpoint not configured" },
        { status: 500 },
      );
    }

    await sendEmail({
      to,
      subject: subject ?? `New message from ${name}`,
      replyTo: email,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
