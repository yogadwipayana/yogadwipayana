import type { ReactNode } from "react";
import { Figtree } from "next/font/google";
import Link from "next/link";
import { Check } from "lucide-react";

import { Logo } from "@/components/ui/Logo";
import { ProviderIcon } from "@/components/ui/ProviderIcons";

const figtree = Figtree({ subsets: ["latin"], display: "swap" });

const PANEL_POINTS = [
  "One account for every tool",
  "One API key for every model",
  "Pay as you go, no subscriptions",
] as const;

const PANEL_MODELS = [
  { name: "GPT 5.6 Sol", provider: "OpenAI" },
  { name: "Claude Opus 4.8", provider: "Anthropic" },
  { name: "Claude Sonnet 5", provider: "Anthropic" },
  { name: "GPT 5.6 Luna", provider: "OpenAI" },
] as const;

type AuthShellProps = {
  title: string;
  subtitle: string;
  /** Small line under the form, e.g. a sign-in / sign-up switch link. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Split-screen shell shared by the auth pages: form column on the left,
 * brand panel with the ambient backdrop and model chips on the right
 * (hidden below lg, where the form column stands alone).
 */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main
      className={`${figtree.className} grid flex-1 tracking-[0] lg:grid-cols-2`}
    >
      {/* Form column */}
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="rise-in flex flex-col items-start">
            <Link
              href="/"
              className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em] text-white"
            >
              <Logo className="h-7 w-7" />
              yoga
            </Link>
            <h1 className="mt-8 text-3xl font-semibold tracking-[-0.02em] text-white">
              {title}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-white/55">
              {subtitle}
            </p>
          </div>

          <div className="rise-in mt-8" style={{ animationDelay: "80ms" }}>
            {children}
          </div>

          {footer && (
            <p
              className="rise-in mt-6 text-[13px] text-white/50"
              style={{ animationDelay: "140ms" }}
            >
              {footer}
            </p>
          )}
        </div>
      </div>

      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-l border-white/[0.08] bg-[#191919] lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(90%_70%_at_50%_40%,#000_35%,transparent_75%)]" />
          <div className="hero-glow absolute left-1/2 top-1/4 h-[420px] w-[560px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(62,207,142,0.14),transparent)]" />
        </div>

        <div className="relative w-full max-w-md px-10">
          <h2 className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-transparent xl:text-4xl">
            One Hub For Every Model
          </h2>

          <ul className="mt-8 space-y-3">
            {PANEL_POINTS.map((point) => (
              <li
                key={point}
                className="flex items-center gap-2.5 text-[15px] text-white/70"
              >
                <Check
                  className="h-4 w-4 shrink-0 text-[#3ecf8e]"
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-2">
            {PANEL_MODELS.map((model) => (
              <span
                key={model.name}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-white/70"
              >
                <ProviderIcon
                  provider={model.provider}
                  className={`h-3.5 w-3.5 shrink-0 ${
                    model.provider === "OpenAI" ? "text-white/80" : ""
                  }`}
                />
                {model.name}
              </span>
            ))}
          </div>

          <p className="mt-10 border-t border-white/[0.08] pt-6 text-[13px] leading-relaxed text-white/40">
            VPS Control, AI Router, Chat AI, and Image Studio, all behind this
            one login.
          </p>
        </div>
      </div>
    </main>
  );
}
