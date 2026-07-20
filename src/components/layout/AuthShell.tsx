import type { ReactNode } from "react";
import { KeyRound, LayoutGrid, UserRound, Wallet } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { PageBackdrop } from "@/components/ui/PageBackdrop";

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Every tool in one place",
    description: "VPS Control, AI Router, Chat AI, and Image Studio.",
  },
  {
    icon: KeyRound,
    title: "One API key for every model",
    description: "Route OpenAI and Anthropic models through a single key.",
  },
  {
    icon: Wallet,
    title: "Pay as you go",
    description: "Top up once, spend it anywhere — no subscriptions.",
  },
] as const;

function AccountBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
      <UserRound className="h-3.5 w-3.5" aria-hidden />
      Account
    </span>
  );
}

type AuthShellProps = {
  title: string;
  subtitle: string;
  /** Small line under the form, e.g. a sign-in / sign-up switch link. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Full-page split shell shared by sign-in, sign-up, and the password pages:
 * the site navbar on top, then a full-height brand panel on the left (hidden
 * below lg) and the form column on the right, centered in the remaining half.
 */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: AuthShellProps) {
  return (
    <>
      <PageBackdrop />
      <Navbar />
      <main className="grid flex-1 lg:grid-cols-2">
        {/* Brand / feature panel */}
        <div className="relative hidden overflow-hidden border-r border-white/[0.06] bg-[#141414] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full [background:radial-gradient(closest-side,rgba(62,207,142,0.12),transparent)]" />
            <div className="absolute bottom-0 right-0 h-[360px] w-[360px] translate-x-1/3 translate-y-1/3 rounded-full [background:radial-gradient(closest-side,rgba(62,207,142,0.07),transparent)]" />
          </div>

          <div className="relative self-start">
            <AccountBadge />
          </div>

          <div className="relative max-w-md">
            <h2 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] text-white xl:text-[36px]">
              One hub for every model.
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-white/45">
              A single account for every tool on this site — and a single API
              key for every model behind them.
            </p>

            <ul className="mt-12 space-y-6">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.title} className="flex items-start gap-3.5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                      <Icon className="h-4 w-4 text-[#3ecf8e]" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-[14px] font-medium text-white/85">
                        {f.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-white/40">
                        {f.description}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="relative max-w-md text-[12px] leading-relaxed text-white/30">
            VPS Control, AI Router, Chat AI, and Image Studio — all behind this
            one login.
          </p>
        </div>

        {/* Form column */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-12 sm:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 lg:hidden"
          >
            <div className="absolute left-1/2 top-0 h-[320px] w-[560px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(62,207,142,0.06),transparent)]" />
          </div>

          <div className="rise-in relative w-full max-w-sm">
            <div className="mb-7 lg:hidden">
              <AccountBadge />
            </div>

            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-white">
              {title}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>

            {footer && (
              <p className="mt-8 text-center text-[13px] text-white/35">
                {footer}
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
