import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ImagePlus,
  MessageSquare,
  Server,
  Waypoints,
} from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "About",
  description:
    "Who Yoga is and what this site is — a personal portfolio and the working hub for a small set of AI-powered developer tools, built in the open from Bali.",
};

const STACK = [
  {
    area: "Web",
    items: "Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI",
  },
  {
    area: "Data & auth",
    items: "Supabase, Prisma, Postgres, AWS S3",
  },
  {
    area: "AI",
    items: "Vercel AI SDK, OpenAI & Anthropic models via the router",
  },
  {
    area: "Infra",
    items: "Tencent Cloud VPS, ssh2 + xterm terminal, AWS, Resend",
  },
] as const;

const TOOLS = [
  {
    icon: Server,
    name: "VPS Control",
    blurb: "Monitor, start, stop, and configure cloud instances from the browser.",
  },
  {
    icon: Waypoints,
    name: "AI Router",
    blurb: "One OpenAI-compatible key for top models, billed pay as you go.",
  },
  {
    icon: MessageSquare,
    name: "Chat AI",
    blurb: "Conversations on the router — switch models mid-thread, run tools.",
  },
  {
    icon: ImagePlus,
    name: "Image Studio",
    blurb: "Generate images from a prompt, kept alongside everything else.",
  },
] as const;

export default function About() {
  return (
    <>
      <Navbar />

      <main className="flex-1">
        {/* Intro */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-28 lg:pt-16 lg:pb-32">
            <div className="flex items-center gap-2 text-[13px] text-white/50">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-[#3ecf8e]"
              />
              About
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Logo className="h-10 w-10" />
              <div className="text-[15px] text-white/50">
                Yoga
                <span className="px-2 text-white/25">·</span>
                Bali, ID
              </div>
            </div>

            <h1 className="mt-8 max-w-3xl text-balance text-4xl font-medium leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
              A builder shipping AI-powered developer tools.
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
              I design and ship small, focused tools — then actually run my
              work from them. This site is where that happens in the open:
              part portfolio, part the control panel I use day to day.
            </p>
          </div>
        </section>

        {/* What this site is */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
            <h2 className="text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
              What this site is
            </h2>
            <div className="max-w-2xl space-y-4 text-base leading-relaxed text-white/60">
              <p>
                It&apos;s two things at once. The public side is a portfolio —
                a place to see what I&apos;m building and how it&apos;s put
                together. The other side is a working hub: a single dashboard
                that hosts every tool behind one account, one key, and one
                billing balance.
              </p>
              <p>
                I build the tools because I need them, use them in the open, and
                write up the architecture and the gotchas as I go. Everything —
                the site, the tools, and the infrastructure behind them — lives
                in one repo.
              </p>
            </div>
          </div>
        </section>

        {/* What I work with */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                What I work with
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/60">
                The stack behind this site and its tools.
              </p>
            </div>

            <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
              {STACK.map((group) => (
                <li key={group.area} className="bg-[#1c1c1c] p-6 sm:p-8">
                  <h3 className="text-[12px] uppercase tracking-wide text-white/40">
                    {group.area}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/70">
                    {group.items}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What's running here */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                What&apos;s running here
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/60">
                The tools that live inside the dashboard today.
              </p>
            </div>

            <ul className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <li key={tool.name} className="flex gap-4">
                    <span
                      aria-hidden
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e]"
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {tool.name}
                      </h3>
                      <p className="mt-1 text-[15px] leading-relaxed text-white/55">
                        {tool.blurb}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Connect */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
            <div className="flex flex-col items-start gap-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                  Let&apos;s connect
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/60">
                  The code is on GitHub and I&apos;m around on LinkedIn. Or jump
                  straight into the tools.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" asChild>
                  <a
                    href="https://github.com/yogadwipayana"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                    <ArrowRight aria-hidden />
                  </a>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <a
                    href="https://www.linkedin.com/in/yoga-dwipayana-9958a1324/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <Link href="/tools">Explore the tools</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
