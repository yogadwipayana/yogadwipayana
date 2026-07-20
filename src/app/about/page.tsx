import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  ImagePlus,
  KeyRound,
  MessageSquare,
  Server,
  Wallet,
  Waypoints,
} from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, pageMetadata, personSchema } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { PageBackdrop } from "@/components/ui/PageBackdrop";
import { Reveal } from "@/components/ui/Reveal";

const figtree = Figtree({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Who Yoga is and what this site is: a personal portfolio and the working hub for a small set of AI-powered developer tools, built and run in the open.",
  path: "/about",
  keywords: [
    "Yoga Dwipayana",
    "software engineer portfolio",
    "AI developer tools",
    "indie developer",
  ],
});

const PRINCIPLES = [
  {
    icon: KeyRound,
    title: "One account for everything",
    blurb:
      "Every tool here shares a single login, a single API key, and a single credit balance. No juggling dashboards.",
  },
  {
    icon: GitBranch,
    title: "Built in the open",
    blurb:
      "The site, the tools, and the infrastructure behind them live in one repo. What you see running is what I ship.",
  },
  {
    icon: Wallet,
    title: "Used before it's sold",
    blurb:
      "I build these tools because I need them for my own work first. If a tool is on this site, I'm running it daily.",
  },
] as const;

const TOOLS = [
  {
    icon: Waypoints,
    name: "AI Router",
    blurb: "One OpenAI-compatible key for top models, billed pay as you go.",
    href: "/ai",
  },
  {
    icon: MessageSquare,
    name: "Chat AI",
    blurb: "Conversations on the router. Switch models mid-thread, run tools.",
    href: "/tools#chat",
  },
  {
    icon: Server,
    name: "VPS Control",
    blurb:
      "Monitor, start, stop, and configure cloud instances from the browser.",
    href: "/tools#vps",
  },
  {
    icon: ImagePlus,
    name: "Image Studio",
    blurb: "Generate images from a prompt, kept alongside everything else.",
    href: "/tools#image",
  },
] as const;

const STACK = [
  {
    area: "Web",
    items: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS", "Radix UI"],
  },
  {
    area: "Data & auth",
    items: ["Supabase", "Prisma", "Postgres", "AWS S3"],
  },
  {
    area: "AI",
    items: ["Vercel AI SDK", "OpenAI models", "Anthropic models"],
  },
  {
    area: "Infra",
    items: ["Tencent Cloud VPS", "ssh2 + xterm", "AWS", "Resend"],
  },
] as const;

export default function About() {
  return (
    <div className={`${figtree.className} flex flex-1 flex-col tracking-[0]`}>
      <JsonLd
        schema={[
          personSchema(),
          breadcrumbSchema([{ name: "About", path: "/about" }]),
        ]}
      />
      <PageBackdrop />
      <Navbar />

      <main className="flex-1">
        {/* Intro */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(110%_75%_at_50%_0%,#000_30%,transparent_72%)]" />
            <div className="hero-glow absolute -top-44 left-1/2 h-[420px] w-[760px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(62,207,142,0.14),transparent)]" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-16 sm:px-8 sm:pt-24 sm:pb-24">
            <span className="rise-in inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[13px] text-white/70">
              The person behind the hub
            </span>

            <h1
              className="rise-in mt-6 max-w-3xl bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-balance text-4xl font-bold leading-[1.08] tracking-[-0.03em] text-transparent sm:text-6xl"
              style={{ animationDelay: "60ms" }}
            >
              Hi, I&apos;m Yoga. I build the tools I use.
            </h1>

            <div
              className="rise-in mt-6 max-w-2xl space-y-4 text-base leading-relaxed text-white/65 sm:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              <p>
                I build small, focused AI tools and run my own work from them.
                This site is both things at once: the public side is a
                portfolio, and the other side is the control panel I use every
                day.
              </p>
              <p>
                Everything runs behind one account, one API key, and one
                billing balance — the site, the tools, and the infrastructure
                behind them, all in a single repo.
              </p>
            </div>

            <div
              className="rise-in mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "180ms" }}
            >
              <Button size="lg" asChild>
                <Link href="/tools">
                  Explore the tools
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/ai">Get an API key</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How I work */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
            <Reveal>
              <div className="max-w-2xl">
                <span className="text-[12px] uppercase tracking-wide text-[#3ecf8e]">
                  How I work
                </span>
                <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                  Three rules the whole site follows
                </h2>
              </div>
            </Reveal>

            <ul className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
              {PRINCIPLES.map((principle, i) => {
                const Icon = principle.icon;
                return (
                  <li key={principle.title}>
                    <Reveal delay={i * 80} className="h-full">
                      <div className="card-sheen h-full rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-6 sm:p-7">
                        <span
                          aria-hidden
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e]"
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <h3 className="mt-5 text-lg font-medium text-white">
                          {principle.title}
                        </h3>
                        <p className="mt-2 text-[15px] leading-relaxed text-white/55">
                          {principle.blurb}
                        </p>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* What's running here */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
            <Reveal>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <span className="text-[12px] uppercase tracking-wide text-[#3ecf8e]">
                    The toolkit
                  </span>
                  <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                    What&apos;s running here
                  </h2>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tools">
                    See all tools
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </Reveal>

            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TOOLS.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <li key={tool.name}>
                    <Reveal delay={i * 70} className="h-full">
                      <Link
                        href={tool.href}
                        className="card-sheen group flex h-full items-start gap-4 rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20"
                      >
                        <span
                          aria-hidden
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e] transition-transform group-hover:scale-105"
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>
                          <h3 className="flex items-center gap-1.5 text-lg font-medium text-white">
                            {tool.name}
                            <ArrowRight
                              className="h-4 w-4 -translate-x-1 text-white/40 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                              aria-hidden
                            />
                          </h3>
                          <p className="mt-1 text-[15px] leading-relaxed text-white/55">
                            {tool.blurb}
                          </p>
                        </span>
                      </Link>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* What I work with */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
            <Reveal>
              <div className="max-w-2xl">
                <span className="text-[12px] uppercase tracking-wide text-[#3ecf8e]">
                  The stack
                </span>
                <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                  What I work with
                </h2>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-10 overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
                {STACK.map((group) => (
                  <div
                    key={group.area}
                    className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-5 last:border-0 sm:flex-row sm:items-center sm:gap-8 sm:px-6"
                  >
                    <h3 className="w-32 shrink-0 font-mono text-[12px] uppercase tracking-wide text-white/40">
                      {group.area}
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <li
                          key={item}
                          className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[13px] text-white/70"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Closing CTA */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
            <Reveal>
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1c1c] p-8 sm:p-12">
                <div
                  aria-hidden
                  className="hero-glow pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full [background:radial-gradient(closest-side,rgba(62,207,142,0.18),transparent)]"
                />
                <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-xl">
                    <h2 className="text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                      See it in action
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-white/60">
                      The best introduction is the product itself. Jump into
                      the tools, or grab a router key and make your first call.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button size="lg" asChild>
                      <Link href="/tools">
                        Explore the tools
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                    <Button size="lg" variant="secondary" asChild>
                      <Link href="/ai">Get an API key</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
