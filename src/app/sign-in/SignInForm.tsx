"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/PasswordField";
import { FormError } from "@/components/ui/FormError";

/** Mirror the server action's open-redirect guard (sanitizeRedirectPath). */
function safeNext(input: string | null): string {
  if (!input || !input.startsWith("/")) return "/dashboard";
  if (input.startsWith("//") || input.startsWith("/\\")) return "/dashboard";
  if (/[\s,]/.test(input)) return "/dashboard";
  return input;
}

const PARAM_ERRORS: Record<string, string> = {
  "auth-callback-failed":
    "That confirmation link is invalid or expired. Try signing in.",
};

export function SignInForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const paramError = PARAM_ERRORS[searchParams.get("error") ?? ""] ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, formAction, pending] = useActionState(signIn, null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !pending;

  // Action error takes precedence; fall back to the on-load query-param error.
  const actionError = state && !state.ok ? state.error : null;
  const error = actionError ?? paramError;

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="next" value={next} />
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
          placeholder="Your password"
          autoComplete="current-password"
          required
          invalid={!!actionError}
          value={password}
          onChange={setPassword}
          labelSlot={
            <Link
              href="/forgot-password"
              className="text-[12px] font-normal text-white/50 transition-colors hover:text-white/80"
            >
              Forgot password?
            </Link>
          }
        />

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
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </div>
    </form>
  );
}
