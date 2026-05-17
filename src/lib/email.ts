import { Resend } from "resend";

let _client: Resend | null = null;

export const resend = () => {
  if (_client) return _client;
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
};

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "no-reply@example.com";

type SendEmailOpts = {
  to: string | string[];
  subject: string;
  replyTo?: string;
} & ({ html: string; text?: string } | { text: string; html?: string });

export async function sendEmail(opts: SendEmailOpts) {
  const base = {
    from: FROM_EMAIL,
    to: opts.to,
    subject: opts.subject,
    replyTo: opts.replyTo,
  };
  const payload =
    "html" in opts && opts.html
      ? { ...base, html: opts.html, text: opts.text }
      : { ...base, text: opts.text! };

  const { data, error } = await resend().emails.send(payload);
  if (error) throw new Error(error.message);
  return data;
}
