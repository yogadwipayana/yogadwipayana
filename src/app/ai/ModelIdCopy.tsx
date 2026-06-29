"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { copyToClipboard } from "@/lib/utils";

export function ModelIdCopy({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(id);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : `Copy ${id}`}
      className="group inline-flex items-center gap-2 rounded-md border border-white/[0.06] bg-[#171717] px-2.5 py-1 font-mono text-[13px] text-white/70 transition-colors hover:border-white/15 hover:text-white"
    >
      {id}
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-[#3ecf8e]" aria-hidden />
      ) : (
        <Copy
          className="h-3.5 w-3.5 shrink-0 text-white/30 transition-colors group-hover:text-white/60"
          aria-hidden
        />
      )}
    </button>
  );
}
