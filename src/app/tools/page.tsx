import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ImagePlus,
  MessageSquare,
  Server,
  Waypoints,
} from "lucide-react";

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
    features: [
      "Drop-in chat completions and embeddings: any OpenAI SDK works",
      "One key reaches GPT and Claude models alike",
      "Create, rename, disable, and revoke API keys",
      "Track spend, request counts, and token usage per day",
      "Per-call log with model, tokens, and cost",
      "Pay-as-you-go top-ups via QRIS, billed in credit",
    ],
  },
  {
    id: "chat",
    icon: MessageSquare,
    tag: "Assistants",
    name: "Chat AI",
    blurb:
      "A chat surface that runs on the router. Stream responses, switch models mid-thread, call tools, and keep every conversation.",
    features: [
      "Streaming replies with conversations you can rename and delete",
      "Switch model or mode mid-thread without losing context",
      "Built-in tools: web search, time, VPS control, and an inline SSH terminal",
      "Edit a message to branch, or regenerate the last reply",
      "Attach images and PDFs: paste, drag, or upload",
      "Share a conversation by public link or export it to Markdown",
    ],
  },
  {
    id: "vps",
    icon: Server,
    tag: "Infrastructure",
    name: "VPS Control",
    blurb:
      "Run your cloud instances from the browser. Bring your own Tencent Cloud account, import what you already have, and manage it without leaving the dashboard.",
    features: [
      "Start, stop, and reboot instances with audit-logged actions",
      "Reset passwords and reinstall the OS from a chosen image",
      "Manage firewall rules: protocol, port, CIDR, accept or drop",
      "Generate or import SSH keys and bind them to instances",
      "Full SSH terminal in the browser over a live WebSocket",
      "Connect a Tencent Cloud account and sync instances on demand",
    ],
  },
  {
    id: "image",
    icon: ImagePlus,
    tag: "Media",
    name: "Image Studio",
    blurb:
      "Generate images from a prompt and keep them organized alongside the rest of your work. Iterate on any result without starting over.",
    features: [
      "Prompt to image with aspect-ratio presets and a quality toggle",
      "Attach up to four reference images for image-to-image",
      "Cancel a generation mid-flight",
      "Browse a paginated history grid and delete individually",
      "Iterate: reload any past image as a reference in one click",
      "Shared backend with Chat AI's image mode",
    ],
  },
];

const MODELS = [
  {
    name: "GPT 5.6 Sol",
    provider: "OpenAI",
    context: "1,050,000",
    input: "$5.00",
    output: "$30.00",
  },
  {
    name: "Claude Opus 4.8",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$5.00",
    output: "$25.00",
  },
  {
    name: "Claude Sonnet 5",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$2.00",
    output: "$10.00",
  },
  {
    name: "GPT 5.6 Luna",
    provider: "OpenAI",
    context: "1,050,000",
    input: "$1.00",
    output: "$6.00",
  },
];

export default function Tools() {
  return (
    <div className={`${figtree.className} flex flex-1 flex-col tracking-[0]`}>
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden border-b border-white/[0.08]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="hero-glow absolute -top-40 left-1/2 h-[400px] w-[760px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(62,207,142,0.12),transparent)]" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 pt-14 pb-14 sm:px-8 sm:pt-20 sm:pb-16">
            <span className="rise-in inline-block text-[12px] uppercase tracking-wide text-[#3ecf8e]">
              The toolkit
            </span>

            <h1
              className="rise-in mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              Four tools, one place to run them.
            </h1>

            <p
              className="rise-in mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              Each tool stands on its own, but they share a single account, one
              key, and one billing balance. Here&apos;s what each one does.
            </p>

            <nav
              aria-label="Tools"
              className="rise-in mt-8 flex flex-wrap gap-2 text-[13px]"
              style={{ animationDelay: "180ms" }}
            >
              {TOOLS.map((tool) => (
                <a
                  key={tool.id}
                  href={`#${tool.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-white/70 transition-colors hover:border-[#3ecf8e]/30 hover:text-white"
                >
                  <tool.icon className="h-4 w-4 text-[#3ecf8e]" aria-hidden />
                  {tool.name}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* Tool sections */}
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <section
              key={tool.id}
              id={tool.id}
              className="scroll-mt-20 border-b border-white/[0.08]"
            >
              <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
                <div className="lg:sticky lg:top-20 lg:self-start">
                  <Reveal>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e]"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-[12px] uppercase tracking-wide text-white/40">
                        {tool.tag}
                      </span>
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
                      {tool.name}
                    </h2>
                    <p className="mt-3 max-w-md text-base leading-relaxed text-white/60">
                      {tool.blurb}
                    </p>
                    <div className="mt-7">
                      <Button asChild>
                        <Link href="/dashboard">
                          Open {tool.name}
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </Reveal>
                </div>

                <div>
                  <Reveal delay={100}>
                    <ul className="space-y-px overflow-hidden rounded-xl border border-white/[0.08]">
                      {tool.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 bg-white/[0.02] px-5 py-4 text-[15px] leading-relaxed text-white/75 transition-colors hover:bg-white/[0.04]"
                        >
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#3ecf8e]"
                            aria-hidden
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </Reveal>

                  {tool.id === "ai" && (
                    <Reveal delay={160}>
                      <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
                        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                          <span className="text-[13px] font-medium text-white">
                            Popular models
                          </span>
                          <span className="rounded-md border border-[#3ecf8e]/15 bg-[#3ecf8e]/[0.06] px-2 py-0.5 text-[11px] font-medium text-[#3ecf8e]">
                            USD / M tokens
                          </span>
                        </div>
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
                                      className={`h-4 w-4 shrink-0 ${
                                        model.provider === "OpenAI"
                                          ? "text-white/80"
                                          : ""
                                      }`}
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
                                  {model.input} / {model.output}
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
                      </div>
                    </Reveal>
                  )}
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
