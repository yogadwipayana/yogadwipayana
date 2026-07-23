"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Phone, Smartphone } from "lucide-react";

/** The number and code that "arrive" each cycle — cosmetic, not a real rental. */
const PHONE = "+1 934 218 0714";
const CODE = "062 815";

/** A trimmed availability strip; figures mirror the real dashboard panel. */
const STATS = [
  { label: "Price", value: "Rp5.000" },
  { label: "Success", value: "92%" },
  { label: "Stock", value: "1,204" },
] as const;

/** Playback phases, in timeline order. */
const PHASES = ["idle", "ordering", "waiting", "received"] as const;
type Phase = (typeof PHASES)[number];

const rank = (phase: Phase) => PHASES.indexOf(phase);

/**
 * Looping scripted replay of the SMS OTP flow: "Get a number" spins up a rental,
 * a disposable number appears and waits on the SMS with a ticking countdown,
 * then the OpenAI verification code lands in green. Rows stay mounted (toggled
 * by opacity) so the card height never shifts between phases.
 */
export function SmsMockLive() {
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(180);
  const [reduced, setReduced] = useState(false);

  // Master timeline: order → wait → receive, once per cycle.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }
    setCountdown(180);
    const timers = [
      window.setTimeout(() => setPhase("ordering"), 600),
      window.setTimeout(() => setPhase("waiting"), 1500),
      window.setTimeout(() => setPhase("received"), 4200),
      // Hold the code, then reset and replay.
      window.setTimeout(() => {
        setPhase("idle");
        setCycle((c) => c + 1);
      }, 7400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  // Tick the rental countdown while the number waits for its SMS.
  useEffect(() => {
    if (phase !== "waiting") return;
    const interval = window.setInterval(() => {
      setCountdown((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const show = (target: Phase) => reduced || rank(phase) >= rank(target);
  const ordering = !reduced && phase === "ordering";
  const waiting = !reduced && phase === "waiting";
  const received = show("received");
  const hasNumber = show("waiting");
  const mm = Math.floor(countdown / 60);
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="p-3.5 sm:p-4">
      {/* Availability strip */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.06]">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-[#171717] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.06em] text-white/35">
              {stat.label}
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Number + code card */}
      <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#171717]">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-white/30" aria-hidden />
            <span
              className={`font-mono text-[15px] tracking-[-0.01em] transition-colors duration-300 ${
                hasNumber ? "text-white" : "text-white/20"
              }`}
            >
              {hasNumber ? PHONE : "+· ··· ··· ····"}
            </span>
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] transition-colors duration-300 ${
              received
                ? "border-[#3ecf8e]/25 bg-[#3ecf8e]/[0.08] text-[#3ecf8e]"
                : hasNumber
                  ? "border-amber-400/25 bg-amber-400/[0.08] text-amber-300"
                  : "border-white/[0.08] bg-white/[0.04] text-white/40"
            }`}
          >
            {waiting && (
              <span className="font-mono text-[10px] tracking-normal">
                {mm}:{ss}
              </span>
            )}
            {received ? "completed" : hasNumber ? "pending" : "idle"}
          </span>
        </div>

        <div className="px-4 py-4">
          {/* Reserve the tallest state's height so the card never jumps. */}
          <div className="relative min-h-[52px]">
            {/* Ordering / waiting */}
            <div
              className={`flex items-center gap-2.5 text-[12.5px] text-white/45 transition-opacity duration-300 ${
                received ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <Loader2
                className={`h-4 w-4 text-white/30 ${
                  ordering || waiting ? "animate-spin" : ""
                }`}
                aria-hidden
              />
              {ordering
                ? "Reserving a number…"
                : hasNumber
                  ? "Waiting for the SMS — enter this number on OpenAI."
                  : "Press “Get a number” to start."}
            </div>

            {/* Received code */}
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${
                received ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.06em] text-white/35">
                Verification code
              </p>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="font-mono text-[24px] font-medium tracking-[0.14em] text-[#3ecf8e]">
                  {CODE}
                </span>
                <Check className="h-4 w-4 text-[#3ecf8e]" aria-hidden />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-white/30">
          <Smartphone className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
          OpenAI · Codex · reusable for ~120h
        </div>
      </div>
    </div>
  );
}
