"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";

import { signUp, type ActionResult } from "@/app/auth/actions";
import { PasswordField } from "@/components/ui/PasswordField";
import { FormError } from "@/components/ui/FormError";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export function EmailPasswordSignUpForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    signUp,
    null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit =
    EMAIL_RE.test(email.trim()) &&
    password.length >= MIN_PASSWORD &&
    passwordsMatch &&
    agree;

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    if (password !== confirm) {
      e.preventDefault();
      setClientError("Passwords do not match.");
      return;
    }
    setClientError(null);
  };

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.06] p-5 text-center"
      >
        <CheckCircle2 className="h-7 w-7 text-[#3ecf8e]" aria-hidden />
        <h2 className="text-[16px] font-medium text-white">Check your inbox</h2>
        <p className="text-[13px] leading-relaxed text-white/65">
          We sent a confirmation link to your email. Click it to activate your
          account, then come back to sign in.
        </p>
        <Link
          href="/sign-in"
          className="mt-1 inline-flex h-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] px-4 text-[13px] font-medium text-white/85 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3"
    >
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
        placeholder="At least 8 characters"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        value={password}
        onChange={setPassword}
        required
      />

      <PasswordField
        id="confirm"
        name="confirm"
        label="Confirm password"
        placeholder="Repeat password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        value={confirm}
        onChange={setConfirm}
        required
        invalid={!!clientError}
      />

      <label className="mt-1 flex cursor-pointer items-start gap-2.5 rounded-md border border-white/[0.08] bg-[#1c1c1c] p-3 text-[13px] leading-relaxed text-white/70 transition-colors hover:border-white/15 has-[input:checked]:border-[#3ecf8e]/40 has-[input:checked]:bg-[#3ecf8e]/5">
        <input
          type="checkbox"
          name="agree"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          required
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-white/20 bg-transparent accent-[#3ecf8e] checked:border-[#3ecf8e] checked:bg-[#3ecf8e] focus:ring-2 focus:ring-[#3ecf8e]/30 focus:outline-none"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/terms"
            className="text-white underline-offset-4 hover:text-[#3ecf8e] hover:underline"
          >
            Terms &amp; conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-white underline-offset-4 hover:text-[#3ecf8e] hover:underline"
          >
            Privacy policy
          </Link>
          .
        </span>
      </label>

      <FormError
        message={
          clientError ?? (state && state.ok === false ? state.error : null)
        }
      />

      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
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
  required,
  minLength,
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
  required?: boolean;
  minLength?: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12px] font-medium text-white/70"
      >
        {label}
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
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] pr-3 pl-9 text-[14px] text-white placeholder:text-white/30 transition-colors focus:border-[#3ecf8e]/60 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/20"
        />
      </div>
    </div>
  );
}
