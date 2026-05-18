"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";

import {
  requestPasswordReset,
  type ActionResult,
} from "@/app/auth/actions";
import { FormError } from "@/components/ui/FormError";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    requestPasswordReset,
    null,
  );
  const [email, setEmail] = useState("");

  const canSubmit = EMAIL_RE.test(email.trim());

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.06] p-5 text-center"
      >
        <CheckCircle2 className="h-7 w-7 text-[#3ecf8e]" aria-hidden />
        <h2 className="text-[16px] font-medium text-white">Check your inbox</h2>
        <p className="text-[13px] leading-relaxed text-white/65">
          If an account exists for that email, we sent a link to reset your
          password.
        </p>
        <Link
          href="/sign-in"
          className="mt-1 inline-flex h-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] px-4 text-[13px] font-medium text-white/85 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[12px] font-medium text-white/70"
        >
          Email
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/40">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@domain.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] pr-3 pl-9 text-[14px] text-white placeholder:text-white/30 transition-colors focus:border-[#3ecf8e]/60 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/20"
          />
        </div>
      </div>

      <FormError
        message={state && state.ok === false ? state.error : null}
      />

      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
