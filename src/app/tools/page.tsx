import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Tools",
  description:
    "A small set of tools that share one account, one key, and one billing balance — VPS Control, AI Router, Chat AI, and Image Studio.",
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
    id: "vps",
    icon: Server,
    tag: "Infrastructure",
    name: "VPS Control",
    blurb:
      "Run your cloud instances from the browser. Bring your own Tencent Cloud account, import what you already have, and manage it without leaving the dashboard.",
    features: [
      "Start, stop, and reboot instances with audit-logged actions",
      "Reset passwords and reinstall the OS from a chosen image",
      "Manage firewall rules — protocol, port, CIDR, accept or drop",
      "Generate or import SSH keys and bind them to instances",
      "Full SSH terminal in the browser over a live WebSocket",
      "Connect a Tencent Cloud account and sync instances on demand",
    ],
  },
  {
    id: "ai",
    icon: Waypoints,
    tag: "Models",
    name: "AI Router",
    blurb:
      "An OpenAI-compatible endpoint at ai.yogathedev.com/v1. Point any client at it, use one key for every model, and pay only for what you use.",
    features: [
      "Drop-in chat completions and embeddings — any OpenAI SDK works",
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
      "Attach images and PDFs — paste, drag, or upload",
      "Share a conversation by public link or export it to Markdown",
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
      "Iterate — reload any past image as a reference in one click",
      "Shared backend with Chat AI's image mode",
    ],
  },
];

const MODELS = [
  {
    name: "GPT-5.5",
    provider: "OpenAI",
    context: "1,000,000",
    input: "$5.00",
    output: "$30.00",
  },
  {
    name: "Claude Opus 4.7",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$5.00",
    output: "$25.00",
  },
  {
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$3.00",
    output: "$15.00",
  },
];

export default function Tools() {
  return (
    <>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-20 lg:pt-16">
            <h1 className="max-w-3xl text-balance text-4xl font-medium leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
              Four tools, one place to run them.
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
              Each tool stands on its own, but they share a single account, one
              key, and one billing balance. Here&apos;s what each one does.
            </p>

            <nav
              aria-label="Tools"
              className="mt-9 flex flex-wrap gap-2 text-[13px]"
            >
              {TOOLS.map((tool) => (
                <a
                  key={tool.id}
                  href={`#${tool.id}`}
                  className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-white/70 transition-colors hover:border-white/20 hover:text-white"
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
                  <h2 className="mt-5 text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                    {tool.name}
                  </h2>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-white/60">
                    {tool.blurb}
                  </p>
                </div>

                <div>
                  <ul className="space-y-px overflow-hidden rounded-xl border border-white/[0.08]">
                    {tool.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 bg-white/[0.02] px-5 py-4 text-[15px] leading-relaxed text-white/75"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#3ecf8e]"
                          aria-hidden
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {tool.id === "ai" && (
                    <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.08]">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-white/[0.08] text-white/40">
                            <th className="px-4 py-3 font-medium">Model</th>
                            <th className="px-4 py-3 font-medium">Provider</th>
                            <th className="hidden px-4 py-3 font-medium sm:table-cell">
                              Context
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              In / Out
                              <span className="text-white/25"> /M</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {MODELS.map((model) => (
                            <tr
                              key={model.name}
                              className="border-b border-white/[0.06] last:border-0"
                            >
                              <td className="px-4 py-3 font-medium text-white">
                                {model.name}
                              </td>
                              <td className="px-4 py-3 text-white/60">
                                {model.provider}
                              </td>
                              <td className="hidden px-4 py-3 text-white/60 sm:table-cell">
                                {model.context}
                              </td>
                              <td className="px-4 py-3 text-right text-white/60">
                                {model.input} / {model.output}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard">
                        Open {tool.name}
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* Closing CTA */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
            <div className="flex flex-col items-start gap-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
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
        </section>
      </main>

      <Footer />
    </>
  );
}
