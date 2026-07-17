"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { copyToClipboard } from "@/lib/utils";

type CopyValueProps = {
  value: string;
  className?: string;
};

/** Monospace value chip that copies itself to the clipboard on click. */
export function CopyValue({ value, className }: CopyValueProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : `Copy ${value}`}
      className={`group inline-flex max-w-full items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[13px] text-[#3ecf8e] transition-colors hover:border-[#3ecf8e]/30${className ? ` ${className}` : ""}`}
    >
      <span className="truncate">{value}</span>
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
