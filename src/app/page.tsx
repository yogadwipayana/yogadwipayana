import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  MessageSquare,
  Server,
  Terminal,
  Waypoints,
} from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Yoga Dwipayana — Polyagentmorous Builder",
  description:
    "Personal portfolio and working hub of Yoga Dwipayana. Building AI-powered developer tools from Bali, Indonesia.",
};

const tools = [
  {
    href: "/vps",
    title: "VPS Control",
    body: "Spin up, monitor, and wind down instances from a single console.",
    icon: Server,
    tag: "Infra",
  },
  {
    href: "/ai",
    title: "AI Router",
    body: "Route prompts across providers and models behind a single key.",
    icon: Waypoints,
    tag: "Models",
  },
  {
    href: "/chat",
    title: "Chat AI",
    body: "A quiet conversational workspace with context and history.",
    icon: MessageSquare,
    tag: "Assistants",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <Navbar />

      <main className="flex-1">
        <Hero />
        <ToolsPreview />
        <Philosophy />
      </main>

      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* faint grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
      />
      {/* emerald glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#3ecf8e]/10 blur-[120px]"
      />

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-12 px-6 pt-20 pb-24 sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,440px)] lg:gap-16 lg:pt-32 lg:pb-32">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
              01 — Hello
            </span>
            <span aria-hidden className="h-px w-10 bg-white/10" />
            <span className="inline-flex items-center gap-2 font-mono text-[11px] text-white/55">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ecf8e]/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
              </span>
              Online from Bali
            </span>
          </div>

          <h1 className="text-[44px] font-medium leading-[0.98] tracking-[-0.04em] text-white sm:text-[60px] md:text-[72px] lg:text-[80px]">
            <span className="block text-white/40">Yoga Dwipayana</span>
            <span className="block">builds quiet</span>
            <span className="block">
              tools that <span className="text-[#3ecf8e]">ship</span>.
            </span>
          </h1>

          <p className="max-w-lg text-[17px] leading-[1.65] text-white/60">
            A polyagentmorous indie builder running a small fleet of AI-powered
            developer tools — VPS, AI router, chat — from one operator console.
            This site is the front door and the cockpit.
          </p>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <Link
              href="/dashboard"
              className="group inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              Open the cockpit
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden />
            </Link>
            <Link
              href="/tools"
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.04]"
            >
              Tour the tools
            </Link>
            <Link
              href="/about"
              className="ml-0 inline-flex items-center gap-1 text-sm text-white/55 transition-colors hover:text-white sm:ml-2"
            >
              <Terminal className="h-3.5 w-3.5" aria-hidden />
              whoami
            </Link>
          </div>
        </div>

        <OperatorConsole />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Operator console — the right-side feature panel                           */
/* -------------------------------------------------------------------------- */

function OperatorConsole() {
  const services = [
    { name: "VPS Control", note: "3 instances · 1 ssh", icon: Server, href: "/dashboard/vps", status: "ok" as const },
    { name: "AI Router", note: "p50 124ms · 0.02% err", icon: Waypoints, href: "/dashboard/ai", status: "ok" as const },
    { name: "Chat AI", note: "context cached · ready", icon: MessageSquare, href: "/dashboard/chat", status: "idle" as const },
  ];

  const ships = [
    { hash: "8aa3e22", msg: "ssh terminal in dashboard", when: "today" },
    { hash: "f698b17", msg: "settings page · more tools", when: "3d" },
    { hash: "f5b9449", msg: "fix copy button · local dev", when: "1w" },
  ];

  return (
    <div className="relative w-full lg:mt-2">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[24px] bg-gradient-to-br from-[#3ecf8e]/10 via-transparent to-transparent blur-2xl"
      />
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 font-mono text-[11px]">
          <span className="flex items-center gap-2 text-white/45">
            <span className="text-[#3ecf8e]">~</span>
            <span className="text-white/30">/</span>
            <span className="text-white/70">tools</span>
          </span>
          <span className="text-white/35">{currentSession()}</span>
        </div>

        <div className="px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">
              Services
            </span>
            <span className="text-[10px] text-white/30">all systems normal</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {services.map(({ name, note, icon: Icon, href, status }) => (
              <li key={name}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-md border border-transparent px-2.5 py-2 transition-colors hover:border-white/[0.08] hover:bg-white/[0.03]"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/70 transition-colors group-hover:border-[#3ecf8e]/30 group-hover:text-[#3ecf8e]">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="flex flex-1 flex-col leading-tight">
                    <span className="text-[13px] font-medium text-white">
                      {name}
                    </span>
                    <span className="font-mono text-[11px] text-white/40">
                      {note}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]">
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${
                        status === "ok" ? "bg-[#3ecf8e]" : "bg-white/40"
                      }`}
                    />
                    <span
                      className={
                        status === "ok" ? "text-[#3ecf8e]" : "text-white/45"
                      }
                    >
                      {status === "ok" ? "live" : "idle"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-white/[0.06] px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">
              Recently shipped
            </span>
            <span className="font-mono text-[10px] text-white/30">git log</span>
          </div>
          <ul className="flex flex-col gap-1 font-mono text-[12px]">
            {ships.map(({ hash, msg, when }) => (
              <li
                key={hash}
                className="flex items-center gap-3 rounded-md px-1.5 py-1 text-white/65"
              >
                <span className="text-[#3ecf8e]">{hash}</span>
                <span className="flex-1 truncate text-white/70">{msg}</span>
                <span className="text-white/35">{when}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#141414] px-4 py-2.5 font-mono text-[11px] text-white/40">
          <span className="flex items-center gap-2">
            <span className="text-[#3ecf8e]">$</span>
            <span>./deploy --next</span>
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-white/40" />
          </span>
          <span>uptime 99.9</span>
        </div>
      </div>
    </div>
  );
}

function currentSession() {
  const date = new Date();
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `session ${hh}:${mm} UTC`;
}

/* -------------------------------------------------------------------------- */
/*  Tools preview                                                             */
/* -------------------------------------------------------------------------- */

function ToolsPreview() {
  return (
    <section className="border-t border-white/[0.08] bg-[#171717]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
        <div className="mb-12 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs uppercase tracking-[0.12em] text-[#3ecf8e]">
              Tools
            </span>
            <h2 className="mt-3 max-w-lg text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
              Three focused utilities.
              <br />
              <span className="text-white/50">One working surface.</span>
            </h2>
          </div>
          <Link
            href="/tools"
            className="group inline-flex items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
          >
            See the full catalogue
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
          </Link>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map(({ href, title, body, icon: Icon, tag }, i) => (
            <li key={href}>
              <Link
                href={href}
                className="group relative flex h-full flex-col gap-6 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-6 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#202020]"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/80 transition-colors group-hover:border-[#3ecf8e]/30 group-hover:bg-[#3ecf8e]/10 group-hover:text-[#3ecf8e]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-mono text-[11px] text-white/30">
                    0{i + 1}
                  </span>
                </div>

                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-white/40">
                    {tag}
                  </div>
                  <h3 className="text-lg font-medium tracking-[-0.01em]">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {body}
                  </p>
                </div>

                <div className="mt-auto flex items-center gap-1.5 text-sm text-white/50 transition-colors group-hover:text-[#3ecf8e]">
                  Open
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Philosophy                                                                */
/* -------------------------------------------------------------------------- */

function Philosophy() {
  const points = [
    "Ship beats perfect — shipped tools teach more than drafts.",
    "Treat AI agents as slot machines for programmers.",
    "Full apps in days, not months.",
  ];

  return (
    <section className="border-t border-white/[0.08]">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div>
          <span className="text-xs uppercase tracking-[0.12em] text-[#3ecf8e]">
            Philosophy
          </span>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
            Quietly technical.
            <br />
            <span className="text-white/50">Loud about shipping.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-[1.65] text-white/60">
            I build tools to solve my own problems, then share them. Lately I
            spend my time exploring how AI changes everything about software
            development.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-[#1c1c1c] p-4 text-[15px] leading-relaxed text-white/80"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3ecf8e]/15 text-[#3ecf8e]">
                <Check className="h-3 w-3" aria-hidden />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  (Footer extracted to src/components/layout/Footer.tsx)                    */
/* -------------------------------------------------------------------------- */
