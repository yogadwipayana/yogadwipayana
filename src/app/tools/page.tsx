import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ImagePlus,
  KeyRound,
  MessageSquare,
  Server,
  Terminal,
  Wallet,
  Waypoints,
} from "lucide-react";

import { ChatMockLive } from "./chat-mock";
import { ImageMockLive } from "./image-mock";
import { VpsMockLive } from "./vps-mock";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ProviderIcon } from "@/components/ui/ProviderIcons";
import { Reveal } from "@/components/ui/Reveal";

const figtree = Figtree({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Tools",
  description:
    "A small set of tools that share one account, one key, and one billing balance: VPS Control, AI Router, Chat AI, and Image Studio.",
};

type ToolSection = {
  id: string;
  icon: typeof Server;
  tag: string;
  name: string;
  blurb: string;
  href: string;
  features: string[];
};

const TOOLS: ToolSection[] = [
  {
    id: "ai",
    icon: Waypoints,
    tag: "Models",
    name: "AI Router",
    blurb:
      "An OpenAI-compatible endpoint at ai.yogathedev.com/v1. Point any client at it, use one key for every model, and pay only for what you use.",
    href: "/dashboard/ai",
    features: [
      "Drop-in chat completions and embeddings",
      "One key reaches GPT and Claude alike",
      "Create, rename, disable, and revoke keys",
      "Spend, requests, and tokens per day",
      "Per-call log with model, tokens, and cost",
      "QRIS top-ups, billed in credit",
    ],
  },
  {
    id: "chat",
    icon: MessageSquare,
    tag: "Assistants",
    name: "Chat AI",
    blurb:
      "A chat surface that runs on the router. Stream responses, switch models mid-thread, call tools, and keep every conversation.",
    href: "/dashboard/chat",
    features: [
      "Streaming replies, conversations you keep",
      "Switch model or mode mid-thread",
      "Web search, time, VPS, and SSH tools",
      "Edit to branch, or regenerate a reply",
      "Attach images and PDFs",
      "Share by link or export to Markdown",
    ],
  },
  {
    id: "vps",
    icon: Server,
    tag: "Infrastructure",
    name: "VPS Control",
    blurb:
      "Run your cloud instances from the browser. Bring your own Tencent Cloud account, import what you already have, and manage it without leaving the dashboard.",
    href: "/dashboard/vps",
    features: [
      "Start, stop, and reboot with an audit log",
      "Reset passwords, reinstall the OS",
      "Firewall rules: protocol, port, CIDR",
      "Generate or import SSH keys",
      "Full SSH terminal over a live WebSocket",
      "Sync Tencent Cloud instances on demand",
    ],
  },
  {
    id: "image",
    icon: ImagePlus,
    tag: "Media",
    name: "Image Studio",
    blurb:
      "Generate images from a prompt and keep them organized alongside the rest of your work. Iterate on any result without starting over.",
    href: "/dashboard/image",
    features: [
      "Aspect-ratio presets and a quality toggle",
      "Up to four references for image-to-image",
      "Cancel a generation mid-flight",
      "Paginated history grid with delete",
      "Reload any past image as a reference",
      "Shared backend with Chat AI's image mode",
    ],
  },
];

const SHARED = [
  {
    icon: KeyRound,
    title: "One key",
    detail: "A single API key works across the router and every SDK.",
  },
  {
    icon: Wallet,
    title: "One balance",
    detail: "Top up once; every tool bills the same credit, per token.",
  },
  {
    icon: Terminal,
    title: "One dashboard",
    detail: "Every tool lives side by side in the same workspace.",
  },
] as const;

const MODELS = [
  {
    name: "GPT 5.6 Sol",
    provider: "OpenAI",
    context: "1,050,000",
    io: "$5.00 / $30.00",
  },
  {
    name: "Claude Opus 4.8",
    provider: "Anthropic",
    context: "1,000,000",
    io: "$5.00 / $25.00",
  },
  {
    name: "Claude Sonnet 5",
    provider: "Anthropic",
    context: "1,000,000",
    io: "$2.00 / $10.00",
  },
  {
    name: "GPT 5.6 Luna",
    provider: "OpenAI",
    context: "1,050,000",
    io: "$1.00 / $6.00",
  },
] as const;

/** OpenAI's mono mark inherits this tint; Claude ships its own brand color. */
function providerTint(provider: string) {
  return provider === "Anthropic" ? "" : "text-white/80";
}

/** Window chrome shared by every tool mockup. */
function MockWindow({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#171717] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]">
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-2 truncate font-mono text-[12px] text-white/35">
          {label}
        </span>
        {badge && (
          <span className="ml-auto shrink-0 rounded-full bg-[#3ecf8e]/10 px-2 py-0.5 text-[11px] font-medium text-[#3ecf8e]">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** AI Router — the live pricing table is the product's argument. */
function RouterMock() {
  return (
    <MockWindow label="ai.yogathedev.com/v1" badge="USD / M tokens">
      <table className="w-full text-left text-[13px]">
        <tbody>
          {MODELS.map((model) => (
            <tr
              key={model.name}
              className="border-b border-white/[0.06] last:border-0"
            >
              <td className="px-4 py-3.5 font-medium text-white">
                <span className="flex items-center gap-2.5">
                  <ProviderIcon
                    provider={model.provider}
                    className={`h-4 w-4 shrink-0 ${providerTint(model.provider)}`}
                  />
                  <span>
                    {model.name}
                    <span className="mt-0.5 block text-[12px] font-normal text-white/40">
                      {model.provider}
                    </span>
                  </span>
                </span>
              </td>
              <td className="hidden px-4 py-3.5 text-white/60 sm:table-cell">
                {model.context}
              </td>
              <td className="px-4 py-3.5 text-right font-mono text-white/60">
                {model.io}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link
        href="/ai"
        className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3 text-[13px] text-white/60 transition-colors hover:text-white"
      >
        See the full model list and pricing
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </MockWindow>
  );
}

/** Chat AI — a compact thread that replays itself: message, tool call,
    then the reply streams in and the loop restarts. */
function ChatMock() {
  return (
    <div className="mx-auto w-full max-w-md">
      <MockWindow label="chat — deploy checklist" badge="Streaming">
        <ChatMockLive />
      </MockWindow>
    </div>
  );
}

/** VPS Control — a compact console that replays itself: the stopped worker
    boots, then the terminal types an SSH command and prints the session. */
function VpsMock() {
  return (
    <div className="mx-auto w-full max-w-md">
      <MockWindow label="vps — instances" badge="Synced">
        <VpsMockLive />
      </MockWindow>
    </div>
  );
}

/** Image Studio — a compact history grid that replays itself: the prompt
    types out, one tile generates, and a real router-made image develops in. */
function ImageMock() {
  return (
    <div className="mx-auto w-full max-w-md">
      <MockWindow label="image studio — history" badge="Generating">
        <ImageMockLive />
      </MockWindow>
    </div>
  );
}

const MOCKUPS: Record<string, () => React.ReactElement> = {
  ai: RouterMock,
  chat: ChatMock,
  vps: VpsMock,
  image: ImageMock,
};

export default function Tools() {
  return (
    <div className={`${figtree.className} flex flex-1 flex-col tracking-[0]`}>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/[0.08]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(110%_75%_at_50%_0%,#000_30%,transparent_72%)]" />
            <div className="hero-glow absolute -top-40 left-1/2 h-[400px] w-[760px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(62,207,142,0.14),transparent)]" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-14 sm:px-8 sm:pt-24 sm:pb-16 lg:pt-28">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <span className="rise-in text-[12px] uppercase tracking-wide text-[#3ecf8e]">
                The toolkit
              </span>

              <h1
                className="rise-in mt-4 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl"
                style={{ animationDelay: "60ms" }}
              >
                Four tools, one place to run them.
              </h1>

              <p
                className="rise-in mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg"
                style={{ animationDelay: "120ms" }}
              >
                Each tool stands on its own, but they share a single account,
                one key, and one billing balance. Here&apos;s what each one
                does.
              </p>

              <nav
                aria-label="Tools"
                className="rise-in mt-8 flex flex-wrap justify-center gap-2 text-[13px]"
                style={{ animationDelay: "180ms" }}
              >
                {TOOLS.map((tool, i) => (
                  <a
                    key={tool.id}
                    href={`#${tool.id}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] py-1.5 pl-2.5 pr-3.5 text-white/70 transition-colors hover:border-[#3ecf8e]/30 hover:text-white"
                  >
                    <span className="font-mono text-[11px] text-white/30 transition-colors group-hover:text-[#3ecf8e]">
                      0{i + 1}
                    </span>
                    <tool.icon className="h-4 w-4 text-[#3ecf8e]" aria-hidden />
                    {tool.name}
                  </a>
                ))}
              </nav>
            </div>

            {/* Shared foundation strip */}
            <div
              className="rise-in mt-12 grid grid-cols-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm sm:mt-16 sm:grid-cols-3"
              style={{ animationDelay: "260ms" }}
            >
              {SHARED.map((item, i) => (
                <div
                  key={item.title}
                  className={`flex items-start gap-3.5 px-5 py-5 sm:px-6 ${
                    i > 0
                      ? "border-t border-white/[0.06] sm:border-l sm:border-t-0"
                      : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e]"
                  >
                    <item.icon className="h-4.5 w-4.5" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium text-white">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-white/50">
                      {item.detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tool sections */}
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          const Mock = MOCKUPS[tool.id];
          const flipped = index % 2 === 1;

          return (
            <section
              key={tool.id}
              id={tool.id}
              className="scroll-mt-20 border-b border-white/[0.08]"
            >
              <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
                <div className={flipped ? "lg:order-2" : ""}>
                  <Reveal>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e]"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-[12px] uppercase tracking-wide text-white/40">
                        <span className="mr-2 font-mono text-white/25">
                          0{index + 1}
                        </span>
                        {tool.tag}
                      </span>
                    </div>

                    <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
                      {tool.name}
                    </h2>
                    <p className="mt-3 max-w-md text-base leading-relaxed text-white/60">
                      {tool.blurb}
                    </p>

                    <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                      {tool.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-[14px] leading-relaxed text-white/70"
                        >
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#3ecf8e]"
                            aria-hidden
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8">
                      <Button asChild>
                        <Link href={tool.href}>
                          Open {tool.name}
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </Reveal>
                </div>

                <div className={flipped ? "lg:order-1" : ""}>
                  <Reveal delay={120}>
                    <Mock />
                  </Reveal>
                </div>
              </div>
            </section>
          );
        })}

        {/* Closing CTA */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
            <Reveal>
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1c1c] p-8 sm:p-12">
                <div
                  aria-hidden
                  className="hero-glow pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full [background:radial-gradient(closest-side,rgba(62,207,142,0.18),transparent)]"
                />
                <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-xl">
                    <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
                      Sign in and start using them
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-white/60">
                      One account unlocks every tool. Create one in a minute, or
                      sign in if you already have it.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button size="lg" asChild>
                      <Link href="/sign-up">
                        Create an account
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                    <Button size="lg" variant="secondary" asChild>
                      <Link href="/sign-in">Sign in</Link>
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
