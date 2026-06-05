import Link from "next/link";
import { ArrowRight, ImagePlus, MessageSquare, Server, Waypoints } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

const TOOLS = [
  {
    icon: Server,
    name: "VPS Control",
    tag: "Infrastructure",
    blurb:
      "Monitor, start, stop, and configure your cloud instances. Connect a Tencent Cloud account to import everything you already run.",
  },
  {
    icon: Waypoints,
    name: "AI Router",
    tag: "Models",
    blurb:
      "An OpenAI-compatible endpoint — reach top models through a single key, billed pay as you go with fallback chains and usage tracking.",
  },
  {
    icon: MessageSquare,
    name: "Chat AI",
    tag: "Assistants",
    blurb:
      "Conversations powered by the router. Switch models mid-thread, run tools, and pick up where you left off.",
  },
  {
    icon: ImagePlus,
    name: "Image Studio",
    tag: "Media",
    blurb:
      "Generate images straight from a prompt, organized alongside the rest of your work in one place.",
  },
] as const;

const ROUTER_SNIPPET = `curl https://ai.yogathedev.com/v1/chat/completions \\
  -H "Authorization: Bearer $YOGA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-opus-4.7",
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`;

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-28 lg:pt-16 lg:pb-32">
            <h1 className="max-w-3xl text-balance text-4xl font-medium leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
              Hi, I&apos;m Yoga — a builder shipping AI-powered developer tools.
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
              This site is both a portfolio and the place I actually run things
              from. One hub for controlling servers, routing AI models, and
              chatting with them — built and used in the open from Bali.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" asChild>
                <Link href="/dashboard">
                  Open the dashboard
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/tools">Explore the tools</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Tools */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                A small set of tools, one place to run them
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/60">
                Each tool lives on its own in the dashboard, sharing a single
                account, key, and billing balance.
              </p>
            </div>

            <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <li
                    key={tool.name}
                    className="group bg-[#1c1c1c] p-6 transition-colors hover:bg-white/[0.02] sm:p-8"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e]"
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="text-[12px] uppercase tracking-wide text-white/40">
                        {tool.tag}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-medium text-white">
                      {tool.name}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/55">
                      {tool.blurb}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* AI Router spotlight */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <span className="inline-flex items-center rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
                AI Router
              </span>
              <h2 className="mt-5 text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                One key, every model
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-white/60">
                Point any OpenAI-compatible client at the router and switch
                between Claude, GPT, and more without changing your code. Usage
                and credit balance stay visible the whole way.
              </p>
              <div className="mt-7">
                <Button variant="outline" asChild>
                  <Link href="/tools">
                    See how it works
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717] shadow-lg">
              <div className="flex items-center gap-1.5 border-b border-white/[0.08] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="ml-2 text-[12px] text-white/35">
                  request.sh
                </span>
              </div>
              <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-white/80">
                <code className="font-mono">{ROUTER_SNIPPET}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
            <div className="flex flex-col items-start gap-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                  Take a look around
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/60">
                  Read a bit about who I am, or jump straight into the dashboard
                  and the tools.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" asChild>
                  <Link href="/dashboard">
                    Open the dashboard
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/about">About me</Link>
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
