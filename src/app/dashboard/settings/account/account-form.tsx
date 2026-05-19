"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";

import { updateDisplayName, type SettingsActionResult } from "../actions";

export function AccountForm({
  initialDisplayName,
}: {
  initialDisplayName: string;
}) {
  const [state, formAction, isPending] = useActionState<
    SettingsActionResult | null,
    FormData
  >(updateDisplayName, null);
  const [displayName, setDisplayName] = useState(initialDisplayName);

  const dirty = displayName.trim() !== initialDisplayName.trim();

  return (
    <form
      action={formAction}
      className="rounded-lg border border-white/[0.08] bg-[#171717]"
    >
      <div className="space-y-5 px-5 py-5">
        <div>
          <h3 className="text-[14px] font-medium text-white">Display name</h3>
          <p className="mt-1 text-[12px] text-white/40">
            Shown next to your avatar across the dashboard.
          </p>
        </div>
        <div>
          <label
            htmlFor="displayName"
            className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35"
          >
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            placeholder="Your name"
            className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
          />
        </div>

        {state && !state.ok ? (
          <p className="text-[12px] text-red-400">{state.error}</p>
        ) : null}
        {state?.ok ? (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-[#3ecf8e]">
            <Check className="h-3 w-3" aria-hidden />
            {state.message ?? "Saved."}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end border-t border-white/[0.05] bg-white/[0.02] px-5 py-3">
        <button
          type="submit"
          disabled={!dirty || isPending}
          className="inline-flex h-8 items-center rounded-md bg-[#3ecf8e] px-4 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/30"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
