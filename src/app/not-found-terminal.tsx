"use client";

import { usePathname } from "next/navigation";

export function NotFoundTerminal() {
  const pathname = usePathname();
  const target = pathname && pathname !== "/" ? pathname : "/the/void";

  return (
    <div className="w-full overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717] font-mono shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 truncate text-xs text-white/40">
          yoga@portfolio: ~
        </span>
      </div>

      <div className="space-y-2 px-4 py-5 text-sm leading-relaxed sm:px-6 sm:py-6">
        <p className="break-all">
          <span className="text-[#3ecf8e]">yoga@portfolio</span>
          <span className="text-white/40">:</span>
          <span className="text-[#7dd3fc]">~</span>
          <span className="text-white/40">$ </span>
          <span className="text-white/90">cd {target}</span>
        </p>
        <p className="text-white/50">
          <span className="text-[#fb7185]">bash:</span> cd: {target}: No such
          file or directory
        </p>
        <p className="text-white/30">exit status 404</p>
        <p className="break-all pt-1">
          <span className="text-[#3ecf8e]">yoga@portfolio</span>
          <span className="text-white/40">:</span>
          <span className="text-[#7dd3fc]">~</span>
          <span className="text-white/40">$ </span>
          <span className="term-cursor inline-block h-[1.1em] w-[0.55em] translate-y-[0.15em] bg-white/80" />
        </p>
      </div>
    </div>
  );
}
