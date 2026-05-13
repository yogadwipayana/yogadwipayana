import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  MessageSquare,
  Server,
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

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 pt-20 pb-24 sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-16 lg:pt-32 lg:pb-32">
        <div className="flex flex-col gap-7">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/80">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]"
            />
            Based in Bali · Building in public
          </span>

          <h1 className="text-[40px] font-medium leading-[1.02] tracking-[-0.035em] text-white sm:text-[56px] md:text-[64px] lg:text-[72px]">
            Portfolio, playground,
            <br />
            and <span className="text-[#3ecf8e]">control room</span>
            <br />
            for my tools.
          </h1>

          <p className="max-w-xl text-[17px] leading-[1.6] text-white/65">
            I&rsquo;m Yoga Dwipayana — a polyagentmorous builder shipping
            AI-powered developer tools from Bali. This site is both a portfolio
            and the hub where I run them.
          </p>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Link
              href="/tools"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              Explore tools
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/about"
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.04]"
            >
              About me
            </Link>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-6 border-t border-white/[0.08] pt-6 text-left sm:gap-10">
            <Stat label="Years shipping" value="3+" />
            <Stat label="Active tools" value="3" />
            <Stat label="Stack" value="TS · Next" />
          </dl>
        </div>

        <DashboardMock />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-white/40">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-medium tracking-tight text-white">
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard mock (the decorative "product UI" panel)                        */
/* -------------------------------------------------------------------------- */

function DashboardMock() {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[24px] bg-gradient-to-br from-[#3ecf8e]/10 via-transparent to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="ml-3 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/50">
            yoga.dev/dashboard
          </span>
        </div>

        {/* body */}
        <div className="grid grid-cols-[120px_1fr] min-h-[320px]">
          {/* sidebar */}
          <aside className="border-r border-white/[0.06] bg-[#141414] p-3">
            <div className="mb-3 px-2 text-[10px] uppercase tracking-[0.1em] text-white/30">
              Tools
            </div>
            <ul className="flex flex-col gap-1 text-[13px]">
              <MockSidebarItem icon={Server} label="VPS" />
              <MockSidebarItem icon={Waypoints} label="Router" active />
              <MockSidebarItem icon={MessageSquare} label="Chat" />
            </ul>
          </aside>

          {/* main */}
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-white">
                  AI Router
                </div>
                <div className="text-[11px] text-white/40">
                  3 routes · healthy
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3ecf8e]/15 px-2 py-0.5 text-[10px] font-medium text-[#3ecf8e]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
                live
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MockMetric label="p50" value="124ms" bar={0.4} />
              <MockMetric label="p95" value="612ms" bar={0.75} />
              <MockMetric label="errors" value="0.02%" bar={0.12} />
            </div>

            <div className="rounded-md border border-white/[0.06] bg-[#1c1c1c]">
              <div className="border-b border-white/[0.06] px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-white/40">
                Recent calls
              </div>
              <ul className="divide-y divide-white/[0.04] font-mono text-[11px]">
                <MockRow method="POST" path="/v1/chat/completions" model="claude-opus-4" ms="312ms" />
                <MockRow method="POST" path="/v1/chat/completions" model="gpt-5" ms="214ms" />
                <MockRow method="POST" path="/v1/embed" model="voyage-3" ms="89ms" />
                <MockRow method="POST" path="/v1/chat/completions" model="claude-opus-4" ms="441ms" />
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockSidebarItem({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  active?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        active ? "bg-white/[0.06] text-white" : "text-white/60"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </li>
  );
}

function MockMetric({
  label,
  value,
  bar,
}: {
  label: string;
  value: string;
  bar: number;
}) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-[#1c1c1c] p-2.5">
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/40">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-medium text-white">{value}</div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[#3ecf8e]"
          style={{ width: `${Math.round(bar * 100)}%` }}
        />
      </div>
    </div>
  );
}

function MockRow({
  method,
  path,
  model,
  ms,
}: {
  method: string;
  path: string;
  model: string;
  ms: string;
}) {
  return (
    <li className="flex items-center justify-between px-3 py-1.5">
      <span className="flex items-center gap-2 text-white/70">
        <span className="rounded bg-[#3ecf8e]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[#3ecf8e]">
          {method}
        </span>
        <span>{path}</span>
        <span className="text-white/30">·</span>
        <span className="text-white/50">{model}</span>
      </span>
      <span className="text-white/40">{ms}</span>
    </li>
  );
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
