"use client";

import { useActionState, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";

import { changePassword, type SettingsActionResult } from "../actions";

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<
    SettingsActionResult | null,
    FormData
  >(changePassword, null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const meetsLength = password.length >= 8;
  const matches = password.length > 0 && password === confirm;
  const canSubmit = meetsLength && matches && !isPending;

  return (
    <form
      action={(formData) => {
        formAction(formData);
        // Optimistically clear inputs — if the server rejects, the user can
        // re-enter; we don't want the password sitting in the DOM either way.
        setPassword("");
        setConfirm("");
      }}
      className="rounded-lg border border-white/[0.08] bg-[#171717]"
    >
      <div className="space-y-5 px-5 py-5">
        <div>
          <h3 className="text-[14px] font-medium text-white">Change password</h3>
          <p className="mt-1 text-[12px] text-white/40">
            Choose a strong password you don&apos;t use elsewhere.
          </p>
        </div>

        <div className="grid gap-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                placeholder="At least 8 characters"
                className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 pr-10 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {show ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35"
            >
              Confirm new password
            </label>
            <input
              id="confirm"
              name="confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              placeholder="Re-enter password"
              className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
            />
          </div>

          <ul className="space-y-1 text-[11px]">
            <li
              className={
                meetsLength ? "text-[#3ecf8e]" : "text-white/35"
              }
            >
              {meetsLength ? "✓" : "·"} At least 8 characters
            </li>
            <li className={matches ? "text-[#3ecf8e]" : "text-white/35"}>
              {matches ? "✓" : "·"} Passwords match
            </li>
          </ul>
        </div>

        {state && !state.ok ? (
          <p className="text-[12px] text-red-400">{state.error}</p>
        ) : null}
        {state?.ok ? (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-[#3ecf8e]">
            <Check className="h-3 w-3" aria-hidden />
            {state.message ?? "Password updated."}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end border-t border-white/[0.05] bg-white/[0.02] px-5 py-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-8 items-center rounded-md bg-[#3ecf8e] px-4 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/30"
        >
          {isPending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
