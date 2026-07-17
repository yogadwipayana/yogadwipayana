"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Paperclip, Terminal } from "lucide-react";

import { ProviderIcon } from "@/components/ui/ProviderIcons";

const REPLY =
  "Done — nginx restarted cleanly and is serving on port 443 again. Uptime check passed.";

/** Playback phases, in timeline order. */
const PHASES = ["idle", "user", "switch", "tool", "tool-done", "typing"] as const;
type Phase = (typeof PHASES)[number];

const rank = (phase: Phase) => PHASES.indexOf(phase);

/**
 * Looping scripted replay of a Chat AI thread: the user message lands, the
 * model switches mid-thread, an SSH tool call runs, and the reply streams in
 * character by character. Every block stays mounted (hidden via opacity) so
 * the card height never shifts while the animation plays.
 */
export function ChatMockLive() {
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [chars, setChars] = useState(0);
  const [reduced, setReduced] = useState(false);

  // Master timeline: advance through the phases once per cycle.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }
    const timers = [
      window.setTimeout(() => setPhase("user"), 400),
      window.setTimeout(() => setPhase("switch"), 1300),
      window.setTimeout(() => setPhase("tool"), 2100),
      window.setTimeout(() => setPhase("tool-done"), 3400),
      window.setTimeout(() => setPhase("typing"), 3800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  // Stream the reply one character at a time.
  useEffect(() => {
    if (phase !== "typing") return;
    const interval = window.setInterval(() => {
      setChars((count) =>
        count >= REPLY.length ? count : count + 1,
      );
    }, 22);
    return () => clearInterval(interval);
  }, [phase, cycle]);

  // Hold the finished thread, then reset and replay.
  useEffect(() => {
    if (phase !== "typing" || chars < REPLY.length) return;
    const timer = window.setTimeout(() => {
      setPhase("idle");
      setChars(0);
      setCycle((c) => c + 1);
    }, 3200);
    return () => clearTimeout(timer);
  }, [phase, chars]);

  const done = reduced || (phase === "typing" && chars >= REPLY.length);
  const show = (target: Phase) => reduced || rank(phase) >= rank(target);
  const typed = reduced ? REPLY : REPLY.slice(0, chars);
  const thinking = !reduced && show("tool") && chars === 0;

  const block = (target: Phase) =>
    `transition-all duration-500 ${
      show(target) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    }`;

  return (
    <div className="flex flex-col gap-3 p-3.5 text-[12.5px] sm:p-4">
      <div className={`flex justify-end ${block("user")}`}>
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-white/[0.06] px-3 py-2 leading-relaxed text-white/85">
          Restart nginx on my VPS and confirm it came back up.
        </div>
      </div>

      <div
        className={`flex items-center gap-2 text-[10.5px] text-white/35 ${block("switch")}`}
      >
        <span className="h-px flex-1 bg-white/[0.06]" />
        switched to
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 font-medium text-white/70">
          <ProviderIcon provider="Anthropic" className="h-3 w-3 shrink-0" />
          Claude Opus 4.8
        </span>
        <span className="h-px flex-1 bg-white/[0.06]" />
      </div>

      <div className="max-w-[92%] leading-relaxed text-white/75">
        <span
          className={`mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[10.5px] text-white/50 ${block("tool")}`}
        >
          <Terminal className="h-3 w-3 text-[#3ecf8e]" aria-hidden />
          ssh: systemctl restart nginx
          {show("tool-done") ? (
            <Check className="h-3 w-3 text-[#3ecf8e]" aria-hidden />
          ) : (
            <span
              aria-hidden
              className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/15 border-t-[#3ecf8e]"
            />
          )}
        </span>

        {/* The invisible full reply reserves the final height so the card
            doesn't grow line by line while the text streams in. */}
        <div className="relative">
          <p className="invisible" aria-hidden>
            {REPLY}
          </p>
          <p className="absolute inset-0">
            {thinking ? (
              <span className="inline-flex items-center gap-1 pt-1.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    aria-hidden
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/30"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            ) : (
              <>
                {typed}
                {!reduced && !done && (
                  <span className="term-cursor ml-0.5 inline-block h-3 w-[6px] translate-y-0.5 bg-[#3ecf8e]" />
                )}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-white/30">
        <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Reply…
        <span
          className={`ml-auto inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md transition-colors duration-300 ${
            done ? "bg-[#3ecf8e] text-[#171717]" : "bg-white/[0.08] text-white/40"
          }`}
        >
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </div>
  );
}
