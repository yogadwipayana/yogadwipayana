"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/FormError";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    null,
  );

  const error = state && !state.ok ? state.error : null;

  if (state?.ok) {
    return (
      <div className="text-center">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]"
        >
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-medium text-white">Check your email</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/55">
          If an account exists for{" "}
          <span className="text-white/80">{email || "that address"}</span>,
          we&apos;ve sent a link to reset your password.
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
    <form action={formAction} noValidate>
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

        <div key={error}>
          <FormError message={error} />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={email.trim().length === 0 || pending}
        >
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Sending link…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </div>
    </form>
  );
}
