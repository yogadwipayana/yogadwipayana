"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { signUp } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/PasswordField";
import { FormError } from "@/components/ui/FormError";

const MIN_PASSWORD_LENGTH = 8;

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [state, formAction, pending] = useActionState(signUp, null);

  const meetsLength = password.length >= MIN_PASSWORD_LENGTH;
  const matches = confirm.length > 0 && password === confirm;
  const canSubmit =
    email.trim().length > 0 && meetsLength && matches && agree && !pending;

  const error = state && !state.ok ? state.error : null;

  const requirements = useMemo(
    () => [
      { met: meetsLength, label: `At least ${MIN_PASSWORD_LENGTH} characters` },
      { met: matches, label: "Passwords match" },
    ],
    [meetsLength, matches],
  );

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-6 text-center sm:p-8">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]"
        >
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-medium text-white">Check your email</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/55">
          We sent a confirmation link to{" "}
          <span className="text-white/80">{email}</span>. Click it to finish
          setting up your account.
        </p>
        <div className="mt-6">
          <Button variant="secondary" className="w-full" asChild>
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-lg border border-white/[0.08] bg-[#171717] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <PasswordField
          name="password"
          label="Password"
          placeholder="Create a password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          invalid={!!error}
          value={password}
          onChange={setPassword}
        />

        <PasswordField
          name="confirm"
          label="Confirm password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          required
          invalid={!!error}
          value={confirm}
          onChange={setConfirm}
        />

        <ul className="flex flex-col gap-1 text-[11px]">
          {requirements.map((req) => (
            <li
              key={req.label}
              className={req.met ? "text-[#3ecf8e]" : "text-white/35"}
            >
              {req.met ? "✓" : "·"} {req.label}
            </li>
          ))}
        </ul>

        <label className="flex items-start gap-2.5 text-[13px] leading-snug text-white/60">
          <input
            type="checkbox"
            name="agree"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-[#1c1c1c] accent-[#3ecf8e]"
          />
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <div key={error}>
          <FormError message={error} />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!canSubmit}
        >
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </div>
    </form>
  );
}
