"use client";

import { useEffect, useState } from "react";
import { Terminal } from "lucide-react";

const CMD = "ssh root@hkg-worker";
const OUTPUT = ["connected as root", "up 14 s · load average: 0.00"] as const;

/** Playback phases, in timeline order. */
const PHASES = ["idle", "starting", "running", "typing", "done"] as const;
type Phase = (typeof PHASES)[number];

const rank = (phase: Phase) => PHASES.indexOf(phase);

const STATIC_INSTANCES = [
  { name: "sgp-web-01", region: "Singapore" },
  { name: "sgp-db-01", region: "Singapore" },
] as const;

/**
 * Looping scripted replay of the VPS console: the stopped worker boots
 * (Stopped → Starting… → Running), then the terminal types an SSH command
 * and prints the session output. Terminal lines stay mounted (hidden via
 * opacity) behind an invisible copy so the card height never shifts.
 */
export function VpsMockLive() {
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
      window.setTimeout(() => setPhase("starting"), 600),
      window.setTimeout(() => setPhase("running"), 2800),
      window.setTimeout(() => setPhase("typing"), 3300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  // Type the SSH command one character at a time.
  useEffect(() => {
    if (phase !== "typing") return;
    const interval = window.setInterval(() => {
      setChars((count) => (count >= CMD.length ? count : count + 1));
    }, 30);
    return () => clearInterval(interval);
  }, [phase, cycle]);

  // Command finished: print the output.
  useEffect(() => {
    if (phase !== "typing" || chars < CMD.length) return;
    const timer = window.setTimeout(() => setPhase("done"), 450);
    return () => clearTimeout(timer);
  }, [phase, chars]);

  // Hold the finished session, then reset and replay.
  useEffect(() => {
    if (phase !== "done") return;
    const timer = window.setTimeout(() => {
      setPhase("idle");
      setChars(0);
      setCycle((c) => c + 1);
    }, 3200);
    return () => clearTimeout(timer);
  }, [phase]);

  const show = (target: Phase) => reduced || rank(phase) >= rank(target);
  const typed = reduced ? CMD : CMD.slice(0, chars);
  const workerRunning = show("running");
  const workerStarting = !reduced && phase === "starting";

  return (
    <>
      <ul className="text-[12px]">
        {STATIC_INSTANCES.map((vps) => (
          <li
            key={vps.name}
            className="flex items-center gap-2.5 border-b border-white/[0.06] px-3.5 py-2.5"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full bg-[#3ecf8e]"
            />
            <span className="font-mono font-medium text-white">{vps.name}</span>
            <span className="hidden text-white/40 sm:inline">{vps.region}</span>
            <span className="ml-auto rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-[#3ecf8e]">
              Running
            </span>
          </li>
        ))}

        <li className="flex items-center gap-2.5 border-b border-white/[0.06] px-3.5 py-2.5">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-500 ${
              workerRunning
                ? "bg-[#3ecf8e]"
                : workerStarting
                  ? "animate-pulse bg-[#3ecf8e]/60"
                  : "bg-white/25"
            }`}
          />
          <span className="font-mono font-medium text-white">hkg-worker</span>
          <span className="hidden text-white/40 sm:inline">Hong Kong</span>
          <span
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors duration-500 ${
              workerRunning
                ? "border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.08] text-[#3ecf8e]"
                : "border-white/[0.1] bg-white/[0.03] text-white/45"
            }`}
          >
            {workerStarting && (
              <span
                aria-hidden
                className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-white/15 border-t-[#3ecf8e]"
              />
            )}
            {workerRunning ? "Running" : workerStarting ? "Starting" : "Stopped"}
          </span>
        </li>
      </ul>

      <div className="bg-[#131313] p-3.5 font-mono text-[11.5px] leading-relaxed">
        {/* The invisible copy reserves the full session height so the card
            doesn't grow while the terminal plays. */}
        <div className="relative">
          <div className="invisible" aria-hidden>
            <p>➜ {CMD}</p>
            {OUTPUT.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="absolute inset-0">
            <p className="text-white/70">
              <Terminal
                className="mr-1.5 inline h-3 w-3 text-[#3ecf8e]"
                aria-hidden
              />
              <span className="text-[#3ecf8e]">➜</span> {typed}
              {!reduced && phase !== "done" && (
                <span className="term-cursor ml-0.5 inline-block h-3 w-[6px] translate-y-0.5 bg-[#3ecf8e]" />
              )}
            </p>
            {OUTPUT.map((line, i) => (
              <p
                key={line}
                className={`text-white/45 transition-opacity duration-500 ${
                  show("done") ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: `${i * 200}ms` }}
              >
                {line}
                {i === OUTPUT.length - 1 && !reduced && show("done") && (
                  <span className="term-cursor ml-1 inline-block h-3 w-[6px] translate-y-0.5 bg-[#3ecf8e]" />
                )}
              </p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
