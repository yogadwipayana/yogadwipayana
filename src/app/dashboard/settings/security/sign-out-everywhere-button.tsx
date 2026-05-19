"use client";

import { useState, useTransition } from "react";
import { LogOut, X } from "lucide-react";

import { signOutEverywhere } from "../actions";

export function SignOutEverywhereButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.03] px-3 text-[12px] font-medium text-white/85 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        Sign out everywhere
      </button>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 backdrop-blur-[2px] sm:items-center sm:p-6"
          onClick={() => !pending && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-xl border border-white/[0.1] bg-[#171717] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-white">
                Sign out everywhere?
              </h3>
              <button
                type="button"
                onClick={() => !pending && setConfirmOpen(false)}
                disabled={pending}
                className="text-white/30 hover:text-white/60 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mb-5 text-[13px] leading-relaxed text-white/55">
              This will revoke every active session for your account, including
              this device. You&apos;ll be redirected to the home page and need to
              sign in again.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    signOutEverywhere();
                  });
                }}
                disabled={pending}
                className="inline-flex h-9 items-center rounded-md border border-red-500/30 bg-red-500/10 px-4 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
              >
                {pending ? "Signing out…" : "Sign out everywhere"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
