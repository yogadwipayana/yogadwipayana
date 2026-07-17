"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus } from "lucide-react";

const SHOTS = [
  {
    src: "/images/tools/studio-server-room.jpg",
    prompt: "isometric server room, emerald neon, volumetric fog",
    alt: "Generated image of an isometric server room lit by emerald neon",
  },
  {
    src: "/images/tools/studio-cat.jpg",
    prompt: "a cute cat wearing a tiny knitted hat",
    alt: "Generated image of a cat wearing a small knitted hat",
  },
  {
    src: "/images/tools/studio-circuit.jpg",
    prompt: "macro circuit board, glowing emerald traces",
    alt: "Generated macro image of a circuit board with glowing green traces",
  },
  {
    src: "/images/tools/studio-aurora.jpg",
    prompt: "low poly mountains under an emerald aurora",
    alt: "Generated low-poly image of mountains under a green aurora",
  },
] as const;

/** Playback phases, in timeline order. */
const PHASES = ["idle", "typing", "generating", "reveal"] as const;
type Phase = (typeof PHASES)[number];

/**
 * Looping replay of Image Studio: the prompt types itself out, one grid tile
 * "generates" behind a spinner and progress bar, then the real image (made by
 * the actual router) develops into place. Each cycle moves to the next tile.
 */
export function ImageMockLive() {
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [chars, setChars] = useState(0);
  const [reduced, setReduced] = useState(false);

  const target = cycle % SHOTS.length;
  const prompt = SHOTS[target].prompt;

  // Master timeline: type → generate → reveal, once per cycle.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }
    const timer = window.setTimeout(() => setPhase("typing"), 400);
    return () => clearTimeout(timer);
  }, [cycle]);

  // Type the prompt one character at a time.
  useEffect(() => {
    if (phase !== "typing") return;
    const interval = window.setInterval(() => {
      setChars((count) => (count >= prompt.length ? count : count + 1));
    }, 20);
    return () => clearInterval(interval);
  }, [phase, prompt]);

  // Prompt finished: run the generation, then reveal.
  useEffect(() => {
    if (phase !== "typing" || chars < prompt.length) return;
    const timer = window.setTimeout(() => setPhase("generating"), 300);
    return () => clearTimeout(timer);
  }, [phase, chars, prompt]);

  useEffect(() => {
    if (phase !== "generating") return;
    const timer = window.setTimeout(() => setPhase("reveal"), 2300);
    return () => clearTimeout(timer);
  }, [phase, cycle]);

  // Hold the finished image, then move on to the next tile.
  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = window.setTimeout(() => {
      setPhase("idle");
      setChars(0);
      setCycle((c) => c + 1);
    }, 3400);
    return () => clearTimeout(timer);
  }, [phase]);

  const typed = reduced ? prompt : prompt.slice(0, chars);
  const typing = !reduced && phase === "typing";

  return (
    <div className="p-3.5 sm:p-4">
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[12px]">
        <ImagePlus className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
        <span className="truncate text-white/70">
          {typed}
          {typing && (
            <span className="term-cursor ml-0.5 inline-block h-3 w-[6px] translate-y-0.5 bg-[#3ecf8e]" />
          )}
        </span>
        <span className="ml-auto hidden shrink-0 rounded-md border border-white/[0.1] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10.5px] text-white/45 sm:inline">
          1:1
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {SHOTS.map((shot, i) => {
          const active = !reduced && i === target;
          const revealed = !active || phase === "reveal";
          return (
            <div
              key={shot.src}
              className={`relative aspect-square overflow-hidden rounded-lg border transition-colors duration-500 ${
                active && !revealed
                  ? "border-[#3ecf8e]/25"
                  : "border-white/[0.08]"
              }`}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                sizes="(min-width: 640px) 210px, 45vw"
                className={`object-cover transition-all duration-700 ${
                  revealed
                    ? "scale-100 opacity-100 blur-0"
                    : "scale-105 opacity-0 blur-md"
                }`}
              />

              {/* Generation overlay on the active tile */}
              <div
                className={`absolute inset-0 flex items-center justify-center bg-white/[0.02] transition-opacity duration-500 ${
                  revealed ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
              >
                <div
                  aria-hidden
                  className="hero-glow absolute inset-0 [background:radial-gradient(closest-side,rgba(62,207,142,0.14),transparent)]"
                />
                <span className="relative inline-flex items-center gap-1.5 text-[11px] text-white/55">
                  <span
                    aria-hidden
                    className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/15 border-t-[#3ecf8e]"
                  />
                  Generating…
                </span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[#3ecf8e]/70 transition-[width] ease-out"
                  style={{
                    width:
                      phase === "generating"
                        ? "90%"
                        : phase === "reveal"
                          ? "100%"
                          : "0%",
                    transitionDuration:
                      phase === "generating" ? "2200ms" : "250ms",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
