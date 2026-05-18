"use client";

import { useActionState, useState } from "react";

import { updatePassword, type ActionResult } from "@/app/auth/actions";
import { PasswordField } from "@/components/ui/PasswordField";
import { FormError } from "@/components/ui/FormError";

const MIN_PASSWORD = 8;

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updatePassword,
    null,
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = password.length >= MIN_PASSWORD && passwordsMatch;

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    if (password !== confirm) {
      e.preventDefault();
      setClientError("Passwords do not match.");
      return;
    }
    setClientError(null);
  };

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3"
    >
      <PasswordField
        id="password"
        name="password"
        label="New password"
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
        placeholder="Repeat new password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        value={confirm}
        onChange={setConfirm}
        required
        invalid={!!clientError}
      />

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
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
