"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { deleteAccount, type SettingsActionResult } from "../actions";

export function DeleteAccountCard({ email }: { email: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [state, formAction, isPending] = useActionState<
    SettingsActionResult | null,
    FormData
  >(deleteAccount, null);

  const matches = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  return (
    <section className="rounded-lg border border-red-500/25 bg-red-500/[0.04]">
      <div className="space-y-3 px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/[0.08] text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <h3 className="text-[14px] font-medium text-white">Delete account</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-white/55">
              Permanently remove your account and all associated data. This can&apos;t
              be undone — your VPS imports, AI keys, and conversations will be
              wiped immediately.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-red-500/20 bg-red-500/[0.03] px-5 py-3">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="inline-flex h-8 items-center rounded-md border border-red-500/40 bg-red-500/10 px-3 text-[12px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
        >
          Delete account
        </button>
      </div>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-4 pb-4 pt-16 backdrop-blur-[2px] sm:items-center sm:p-6"
          onClick={() => !isPending && setConfirmOpen(false)}
        >
          <form
            action={formAction}
            className="w-full max-w-[480px] rounded-xl border border-red-500/30 bg-[#171717] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-white">
                Delete your account?
              </h3>
              <button
                type="button"
                onClick={() => !isPending && setConfirmOpen(false)}
                disabled={isPending}
                className="text-white/30 hover:text-white/60 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mb-4 text-[13px] leading-relaxed text-white/55">
              This permanently deletes your account and all associated data.
              To confirm, type your email{" "}
              <span className="font-mono text-white/85">{email}</span> below.
            </p>
            <input
              name="confirmEmail"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email}
              autoComplete="off"
              className="mb-3 w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[13px] text-white placeholder:text-white/20 focus:border-red-500/40 focus:outline-none"
            />

            {state && !state.ok ? (
              <p className="mb-3 text-[12px] text-red-400">{state.error}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
                className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!matches || isPending}
                className="inline-flex h-9 items-center rounded-md border border-red-500/40 bg-red-500/15 px-4 text-[13px] font-medium text-red-300 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "Deleting…" : "Delete account permanently"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
