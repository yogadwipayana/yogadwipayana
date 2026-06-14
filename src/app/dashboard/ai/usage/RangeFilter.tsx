"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Range options                                                              */
/* -------------------------------------------------------------------------- */

const PRESETS = [
  { value: "1d", label: "Last 24 hours" },
  { value: "1w", label: "Last 7 days" },
  { value: "1m", label: "Last 30 days" },
] as const;

type RangeValue = (typeof PRESETS)[number]["value"] | "custom";

function labelFor(range: string, from: string | null, to: string | null): string {
  if (range === "custom" && from && to) return `${from} → ${to}`;
  return PRESETS.find((p) => p.value === range)?.label ?? "Last 24 hours";
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function RangeFilter() {
  const router = useRouter();
  const params = useSearchParams();

  const range = (params.get("range") ?? "1d") as RangeValue;
  const fromParam = params.get("from");
  const toParam = params.get("to");

  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(range === "custom");
  const [from, setFrom] = useState(fromParam ?? "");
  const [to, setTo] = useState(toParam ?? "");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function applyPreset(value: RangeValue) {
    const next = new URLSearchParams(params.toString());
    next.set("range", value);
    next.delete("from");
    next.delete("to");
    next.delete("page");
    setShowCustom(false);
    setOpen(false);
    router.push(`?${next.toString()}`);
  }

  function applyCustom() {
    if (!from || !to) return;
    const next = new URLSearchParams(params.toString());
    next.set("range", "custom");
    next.set("from", from);
    next.set("to", to);
    next.delete("page");
    setOpen(false);
    router.push(`?${next.toString()}`);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#171717] px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.04] hover:text-white"
      >
        <Calendar className="h-3.5 w-3.5 text-white/40" />
        <span>{labelFor(range, fromParam, toParam)}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-lg border border-white/[0.08] bg-[#1c1c1c] p-1 shadow-xl shadow-black/40">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => applyPreset(p.value)}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              {p.label}
              {range === p.value && <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />}
            </button>
          ))}

          <div className="my-1 h-px bg-white/[0.06]" />

          <button
            type="button"
            onClick={() => setShowCustom((v) => !v)}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            Custom range
            {range === "custom" && <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />}
          </button>

          {showCustom && (
            <div className="space-y-2 px-2.5 pb-2 pt-1.5">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.1em] text-white/35">From</span>
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/[0.08] bg-[#171717] px-2 py-1.5 text-[12px] text-white/80 outline-none focus:border-white/20 [color-scheme:dark]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.1em] text-white/35">To</span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/[0.08] bg-[#171717] px-2 py-1.5 text-[12px] text-white/80 outline-none focus:border-white/20 [color-scheme:dark]"
                />
              </label>
              <button
                type="button"
                onClick={applyCustom}
                disabled={!from || !to}
                className="w-full rounded-md bg-[#3ecf8e] px-3 py-1.5 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
