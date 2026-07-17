import type { Metadata } from "next";
import { Figtree } from "next/font/google";
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
import { Reveal } from "@/components/ui/Reveal";

const figtree = Figtree({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "About",
  description:
    "Who Yoga is and what this site is: a personal portfolio and the working hub for a small set of AI-powered developer tools, built in the open from Bali.",
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

export default function About() {
  return (
    <div className={`${figtree.className} flex flex-1 flex-col tracking-[0]`}>
      <Navbar />

      <main className="flex-1">
        {/* Intro */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-20">
            <div className="rise-in flex items-center gap-3">
              <Logo className="h-9 w-9" />
              <span className="text-[15px] text-white/50">Yoga, Bali ID</span>
            </div>

            <h1
              className="rise-in mt-8 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              Hi, I&apos;m Yoga.
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
                Everything runs behind one account, one API key, and one billing
                balance. I build the tools because I need them, use them in the
                open, and keep the site, the tools, and the infrastructure
                behind them in a single repo.
              </p>
            </div>
          </div>
        </section>

        {/* What's running here */}
        <section className="border-b border-white/[0.08]">
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
        <section className="border-b border-white/[0.08]">
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

            <ul className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
              {STACK.map((group, i) => (
                <li key={group.area} className="bg-[#1c1c1c]">
                  <Reveal delay={i * 70} className="h-full">
                    <div className="h-full p-6 sm:p-8">
                      <h3 className="text-[12px] uppercase tracking-wide text-white/40">
                        {group.area}
                      </h3>
                      <p className="mt-3 text-[15px] leading-relaxed text-white/70">
                        {group.items}
                      </p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Connect */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
            <Reveal>
              <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <h2 className="text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                    See it in action
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-white/60">
                    The best introduction is the product itself. Jump into the
                    tools, or grab a router key and make your first call.
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
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
