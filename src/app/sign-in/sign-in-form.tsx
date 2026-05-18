"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";

import {
  resendConfirmation,
  signIn,
  type ActionResult,
} from "@/app/auth/actions";
import { PasswordField } from "@/components/ui/PasswordField";
import { FormError } from "@/components/ui/FormError";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailPasswordSignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const callbackError = searchParams.get("error");

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    signIn,
    null,
  );
  const [resendState, resendAction, resendPending] = useActionState<
    ActionResult | null,
    FormData
  >(resendConfirmation, null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = EMAIL_RE.test(email.trim()) && password.length > 0;

  const showResend =
    state && state.ok === false && state.code === "email_not_confirmed";

  const errorMessage =
    state && state.ok === false
      ? state.error
      : callbackError === "auth-callback-failed"
        ? "Email confirmation link expired or invalid. Try signing in again."
        : null;

  return (
    <div className="flex flex-col gap-3">
      <form action={action} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />

        <Field
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@domain.com"
          autoComplete="email"
          icon={<Mail className="h-4 w-4" aria-hidden />}
          value={email}
          onChange={setEmail}
          required
        />

        <PasswordField
          id="password"
          name="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          labelSlot={
            <Link
              href="/forgot-password"
              className="text-[12px] font-medium text-white/55 transition-colors hover:text-[#3ecf8e]"
            >
              Forgot?
            </Link>
          }
          required
        />

        <FormError message={errorMessage} />

        <button
          type="submit"
          disabled={pending || !canSubmit}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {showResend ? (
        resendState?.ok ? (
          <p
            role="status"
            className="auth-error-in flex items-center justify-center gap-1.5 text-[12px] text-[#3ecf8e]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Confirmation email sent. Check your inbox.
          </p>
        ) : (
          <form
            action={resendAction}
            className="auth-error-in flex flex-col gap-1.5"
          >
            <input type="hidden" name="email" value={email} />
            <button
              type="submit"
              disabled={resendPending || !EMAIL_RE.test(email.trim())}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-4 text-[13px] font-medium text-white/85 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendPending ? "Sending…" : "Resend confirmation email"}
            </button>
            {resendState && resendState.ok === false ? (
              <FormError message={resendState.error} />
            ) : null}
          </form>
        )
      ) : null}
    </div>
  );
}

function Field({
  id,
  name,
  type,
  label,
  placeholder,
  autoComplete,
  icon,
  labelSlot,
  required,
  value,
  onChange,
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  placeholder: string;
  autoComplete?: string;
  icon: React.ReactNode;
  labelSlot?: React.ReactNode;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-center justify-between text-[12px] font-medium text-white/70"
      >
        <span>{label}</span>
        {labelSlot}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/40">
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] pr-3 pl-9 text-[14px] text-white placeholder:text-white/30 transition-colors focus:border-[#3ecf8e]/60 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/20"
        />
      </div>
    </div>
  );
}
