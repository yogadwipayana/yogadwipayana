"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

type Step = "request" | "verify";

export function EmailOtpForm() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  if (step === "request") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[12px] font-medium text-white/70"
          >
            Email
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/40">
              <Mail className="h-4 w-4" aria-hidden />
            </span>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] pr-3 pl-9 text-[14px] text-white placeholder:text-white/30 transition-colors focus:border-[#3ecf8e]/60 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/20"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!email}
          onClick={() => setStep("verify")}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send sign-in code
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-white/60">
        We sent a 6-digit code to{" "}
        <span className="text-white/90">{email}</span>. Paste it below.
      </p>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="token"
          className="flex items-center justify-between text-[12px] font-medium text-white/70"
        >
          <span>Sign-in code</span>
          <span className="text-white/40">6 digits</span>
        </label>
        <input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="••••••"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
          required
          autoFocus
          className="h-14 w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 text-center font-mono text-[22px] tracking-[0.5em] text-white placeholder:text-white/20 transition-colors focus:border-[#3ecf8e]/60 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/20"
        />
      </div>

      <button
        type="button"
        disabled={token.length !== 6}
        className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Verify &amp; continue
      </button>

      <button
        type="button"
        onClick={() => {
          setToken("");
          setStep("request");
        }}
        className="inline-flex h-10 w-full items-center justify-center rounded-md border border-white/[0.08] bg-transparent px-5 text-[13px] font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
      >
        Use a different email
      </button>
    </div>
  );
}
