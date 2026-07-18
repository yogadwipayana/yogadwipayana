"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/PasswordField";
import { FormError } from "@/components/ui/FormError";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, formAction, pending] = useActionState(updatePassword, null);

  const meetsLength = password.length >= MIN_PASSWORD_LENGTH;
  const matches = confirm.length > 0 && password === confirm;
  const canSubmit = meetsLength && matches && !pending;

  const error = state && !state.ok ? state.error : null;

  const requirements = useMemo(
    () => [
      { met: meetsLength, label: `At least ${MIN_PASSWORD_LENGTH} characters` },
      { met: matches, label: "Passwords match" },
    ],
    [meetsLength, matches],
  );

  return (
    <form action={formAction} noValidate>
      <div className="flex flex-col gap-4">
        <PasswordField
          name="password"
          label="New password"
          placeholder="Create a new password"
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
          placeholder="Re-enter your new password"
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
              Updating password…
            </>
          ) : (
            "Update password"
          )}
        </Button>

        {error ? (
          <p className="text-center text-[12px] text-white/45">
            Link expired?{" "}
            <Link
              href="/forgot-password"
              className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
            >
              Request a new one
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}
