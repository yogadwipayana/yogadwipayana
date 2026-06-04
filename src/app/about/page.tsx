import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Hammer,
  Lightbulb,
  MapPin,
  Terminal as TerminalIcon,
} from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "About",
  description:
    "About Yoga Dwipayana — a polyagentmorous builder shipping AI-powered developer tools from Bali, and what this site is for.",
};

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <Navbar />

      <main className="flex-1">
        <Intro />
        <Now />
        <Projects />
        <Principles />
        <Stack />
        <Connect />
      </main>

      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                     */
/* -------------------------------------------------------------------------- */

function Intro() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.08]">
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

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-7 px-6 pt-8 pb-10 sm:px-8 sm:pt-10 sm:pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-10 lg:pt-12 lg:pb-14">
        <div className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/70">
            <MapPin className="h-3 w-3 text-[#3ecf8e]" aria-hidden />
            ~/about · bali · indonesia
          </span>

          <h1 className="text-[38px] font-medium leading-[1.02] tracking-[-0.035em] text-white sm:text-[52px] md:text-[60px] lg:text-[64px]">
            Hi, I&rsquo;m <span className="text-[#3ecf8e]">Yoga</span>.
            <br />
            I build tools that
            <br />
            ship themselves.
          </h1>

          <p className="max-w-xl text-[17px] leading-[1.65] text-white/70">
            Deep in vibe-coding mode — building AI-powered developer tools at
            ludicrous speed out of Bali. After 3+ years shipping modern web,
            this feels like a breath of fresh air.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tools"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              See what I&rsquo;m building
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="mailto:hi@yogadwipayana.com"
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.04]"
            >
              Get in touch
            </a>
          </div>
        </div>

        <WhoAmI />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  WhoAmI — terminal REPL replacing the avatar card                          */
/* -------------------------------------------------------------------------- */

function WhoAmI() {
  const rows: { k: string; v: React.ReactNode }[] = [
    { k: "name", v: <span className="text-white/90">Yoga Dwipayana</span> },
    { k: "role", v: <span className="text-white/90">Founder · Builder</span> },
    { k: "based", v: <span className="text-white/90">Bali, Indonesia</span> },
    { k: "company", v: <span className="text-white/90">Dwipa · AI router</span> },
    {
      k: "stack",
      v: <span className="text-white/90">TypeScript · Node · Next</span>,
    },
    {
      k: "mode",
      v: <span className="text-white/90">vibe-coding · polyagent</span>,
    },
    { k: "agents", v: <span className="text-white/90">3–6 Claude · concurrent</span> },
    { k: "years", v: <span className="text-white/90">3+ shipping</span> },
    {
      k: "status",
      v: (
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-[#3ecf8e]/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
          </span>
          <span className="text-[#3ecf8e]">building in public</span>
        </span>
      ),
    },
  ];

  return (
    <aside className="relative w-full">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[24px] bg-gradient-to-br from-[#3ecf8e]/10 via-transparent to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="ml-3 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/50">
            <TerminalIcon className="h-3 w-3" aria-hidden />
            ~/yoga — zsh
          </span>
        </div>

        {/* body */}
        <div className="flex flex-col gap-3 p-5 font-mono text-[13px] leading-[1.65] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="text-[#3ecf8e]">~</span>
            <span className="text-white/30">$</span>
            <span className="text-white/90">yoga whoami --all</span>
          </div>

          <dl className="mt-1 flex flex-col">
            {rows.map(({ k, v }) => (
              <div
                key={k}
                className="grid grid-cols-[88px_1fr] items-baseline gap-x-3 py-0.5"
              >
                <dt className="text-white/40">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[#3ecf8e]">~</span>
            <span className="text-white/30">$</span>
            <span
              aria-hidden
              className="inline-block h-4 w-2 animate-pulse bg-white/70"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Now — what I'm actually working on                                        */
/* -------------------------------------------------------------------------- */

function Now() {
  const items = [
    {
      icon: Hammer,
      kind: "Building",
      title: "Dwipa — the AI router",
      body: "Routing prompts between models so the right one answers the right job. Live at dwipa.my.id.",
      updated: "this week",
    },
    {
      icon: Lightbulb,
      kind: "Doing",
      title: "Living in the future",
      body: "Learning and building tools to make agentic engineering faster for everyone. Full apps in days, not months.",
      updated: "ongoing",
    },
    {
      icon: BookOpen,
      kind: "Thinking",
      title: "Agents as slot machines",
      body: "Fast, stochastic, occasionally brilliant. Running 3–6 Claude instances at once changes how you plan work.",
      updated: "ongoing",
    },
  ];

  return (
    <section className="border-b border-white/[0.08] bg-[#171717]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-[#3ecf8e]">
              /now
            </span>
            <h2 className="mt-2 text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
              What I&rsquo;m actually
              <br />
              <span className="text-white/50">working on.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/50">
            A snapshot of the things I&rsquo;m building, reading, and thinking
            about. Updated whenever it shifts.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, kind, title, body, updated }) => (
            <li
              key={title}
              className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-5 transition-colors hover:border-white/20 hover:bg-[#202020]"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/80 transition-colors group-hover:border-[#3ecf8e]/30 group-hover:bg-[#3ecf8e]/10 group-hover:text-[#3ecf8e]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-mono text-[11px] text-white/30">
                  {updated}
                </span>
              </div>

              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-white/40">
                  {kind}
                </div>
                <h3 className="text-[15px] font-medium tracking-tight text-white">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Projects                                                                  */
/* -------------------------------------------------------------------------- */

type Project = {
  name: string;
  blurb: string;
  href: string;
  tags: string[];
  year: string;
};

function Projects() {
  const current: Project[] = [
    {
      name: "Dwipa",
      blurb: "The AI router — sends each prompt to the model that fits it best.",
      href: "https://dwipa.my.id",
      tags: ["Next.js", "TypeScript", "AI"],
      year: "2024 →",
    },
  ];

  const legacy: Project[] = [
    {
      name: "WBS POS",
      blurb: "Point-of-sale system for a small coffee operation.",
      href: "https://github.com/steipete/wbs",
      tags: ["Web", "POS"],
      year: "Earlier",
    },
  ];

  return (
    <section className="border-b border-white/[0.08]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <span className="text-xs uppercase tracking-[0.12em] text-[#3ecf8e]">
            Selected work
          </span>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
            Projects and prototypes.
          </h2>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <ProjectGroup title="Active" items={current} accent />
          <ProjectGroup title="Previously" items={legacy} />
        </div>
      </div>
    </section>
  );
}

function ProjectGroup({
  title,
  items,
  accent,
}: {
  title: string;
  items: Project[];
  accent?: boolean;
}) {
  return (
    <div>
      <h3
        className={`mb-3 text-xs uppercase tracking-[0.12em] ${
          accent ? "text-[#3ecf8e]" : "text-white/40"
        }`}
      >
        {title}
      </h3>
      <ul className="flex flex-col divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#1c1c1c]">
        {items.map((p) => (
          <li key={p.name}>
            <a
              href={p.href}
              target={p.href.startsWith("http") ? "_blank" : undefined}
              rel={
                p.href.startsWith("http") ? "noopener noreferrer" : undefined
              }
              className="group flex flex-col gap-2.5 px-5 py-4 transition-colors hover:bg-[#202020]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-medium tracking-tight text-white">
                      {p.name}
                    </h4>
                    <span className="font-mono text-[11px] text-white/40">
                      {p.year}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    {p.blurb}
                  </p>
                </div>
                <ArrowUpRight
                  className="mt-1 h-4 w-4 shrink-0 text-white/40 transition-all group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-[#3ecf8e]"
                  aria-hidden
                />
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-white/60"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Principles                                                                */
/* -------------------------------------------------------------------------- */

function Principles() {
  const points = [
    {
      headline: "Ship beats perfect.",
      body: "I build tools to solve my own problems first, then share them. Shipped work teaches you things drafts never will.",
    },
    {
      headline: "AI agents are slot machines for programmers.",
      body: "Fast, stochastic, occasionally brilliant. I run 3–6 Claude instances at once — set the stakes, pull the lever, and know when to walk.",
    },
    {
      headline: "Full apps in days, not months.",
      body: "Small scope, fast loop, a running instance by Friday. Everything else is theatre.",
    },
  ];

  return (
    <section className="border-b border-white/[0.08] bg-[#171717]">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-7 px-6 py-10 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-10">
        <div>
          <span className="text-xs uppercase tracking-[0.12em] text-[#3ecf8e]">
            Principles
          </span>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
            Three things I
            <br />
            <span className="text-white/50">actually believe.</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-[1.65] text-white/60">
            Not manifesto material — just the load-bearing opinions behind how
            I work and what I ship.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {points.map((p, i) => (
            <li
              key={p.headline}
              className="grid grid-cols-[auto_1fr] items-start gap-4 rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-5"
            >
              <span className="font-mono text-[13px] text-[#3ecf8e]">
                0{i + 1}
              </span>
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.01em] text-white sm:text-[20px]">
                  {p.headline}
                </h3>
                <p className="mt-1.5 text-[15px] leading-[1.6] text-white/60">
                  {p.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stack                                                                     */
/* -------------------------------------------------------------------------- */

function Stack() {
  const groups: { label: string; items: string[] }[] = [
    { label: "Language", items: ["TypeScript", "JavaScript"] },
    { label: "Runtime", items: ["Node.js", "Next.js", "Web"] },
    { label: "AI", items: ["Claude", "Codex", "MCP"] },
    { label: "Interface", items: ["CLI", "Supabase", "Vercel"] },
  ];

  return (
    <section className="border-b border-white/[0.08]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs uppercase tracking-[0.12em] text-[#3ecf8e]">
              Stack
            </span>
            <h2 className="mt-2 text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
              Tools I reach for.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/50">
            A working set — grouped by what they do, not by what&rsquo;s
            trendy.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g) => (
            <li
              key={g.label}
              className="rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.1em] text-white/40">
                  {g.label}
                </span>
                <span className="font-mono text-[11px] text-white/30">
                  {g.items.length}
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {g.items.map((i) => (
                  <li
                    key={i}
                    className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 font-mono text-[12px] text-white/80"
                  >
                    {i}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Connect                                                                   */
/* -------------------------------------------------------------------------- */

function Connect() {
  return (
    <section>
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-12">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] px-6 py-8 sm:px-10 sm:py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 right-0 h-[280px] w-[480px] rounded-full bg-[#3ecf8e]/10 blur-[120px]"
          />
          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10">
            <div>
              <span className="text-xs uppercase tracking-[0.12em] text-[#3ecf8e]">
                Connect
              </span>
              <h2 className="mt-2 text-3xl font-medium tracking-[-0.025em] sm:text-4xl md:text-[42px]">
                Say hi — or just watch me ship.
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-[1.65] text-white/60">
                Easiest to reach on GitHub or LinkedIn. If you&rsquo;re
                building something weird with AI, I want to see it.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="https://github.com/yogadwipayana"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.04]"
              >
                <GithubIcon className="h-4 w-4" />
                GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/yoga-dwipayana-9958a1324/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
              >
                <LinkedinIcon className="h-4 w-4" />
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.17c-3.34.72-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.32.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.65-1.85 3.39-1.85 3.63 0 4.3 2.39 4.3 5.5v6.24ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .78 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .78 23.2 0 22.22 0Z" />
    </svg>
  );
}
