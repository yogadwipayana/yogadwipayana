import { NextResponse } from "next/server";
import { z } from "zod";

import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

const BodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  subject: z.string().min(1).max(160).optional(),
  message: z.string().min(1).max(5_000),
  // simple honeypot for bots
  website: z.string().optional(),
});

/**
 * POST /api/email — contact form endpoint.
 * Public on purpose (no auth) so visitors can reach out. Lightly hardened
 * with a honeypot + size limits. Add rate limiting in front for production.
 */
export async function POST(request: Request) {
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
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
