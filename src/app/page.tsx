import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ImagePlus,
  MessageSquare,
  Server,
  Sparkles,
  Terminal,
  Waypoints,
  Zap,
} from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { CopyValue } from "@/components/ui/CopyValue";
import { ProviderIcon } from "@/components/ui/ProviderIcons";
import { Reveal } from "@/components/ui/Reveal";
import { TypedText } from "@/components/ui/TypedText";

// Closest open-source match to Supabase's proprietary Circular typeface.
const figtree = Figtree({ subsets: ["latin"], display: "swap" });

const BASE_URL = "https://ai.yogathedev.com/v1";

export const metadata: Metadata = {
  title: "Yoga | AI Router, Chat, VPS & Image tools in one hub",
  description:
    "One OpenAI-compatible key for GPT and Claude, plus a browser VPS console, chat, and image studio. Pay as you go, built and run in the open from Bali.",
};

type ToolCard = {
  icon: typeof Server;
  name: string;
  tag: string;
  blurb: string;
  href: string;
  span: string;
  accent?: boolean;
};

const TOOLS: ToolCard[] = [
  {
    icon: Waypoints,
    name: "AI Router",
    tag: "Models",
    blurb:
      "One OpenAI-compatible key that reaches GPT and Claude alike. Fallback chains, per-token billing, and live usage tracking.",
    href: "/ai",
    span: "lg:col-span-3",
    accent: true,
  },
  {
    icon: MessageSquare,
    name: "Chat AI",
    tag: "Assistants",
    blurb:
      "Streaming chat on the router. Switch models mid-thread, call tools, branch a message, and keep every conversation.",
    href: "/tools#chat",
    span: "lg:col-span-3",
  },
  {
    icon: Server,
    name: "VPS Control",
    tag: "Infrastructure",
    blurb:
      "Run cloud instances from the browser: start, stop, reinstall, firewall rules, and a live SSH terminal.",
    href: "/tools#vps",
    span: "lg:col-span-2",
  },
  {
    icon: ImagePlus,
    name: "Image Studio",
    tag: "Media",
    blurb:
      "Prompt to image with aspect presets, reference images, and a history grid you can iterate on.",
    href: "/tools#image",
    span: "lg:col-span-2",
  },
  {
    icon: Sparkles,
    name: "AI Store",
    tag: "For sale",
    blurb:
      "Router vouchers, verified ChatGPT Plus, and Kiro dev accounts, all ready to buy.",
    href: "/ai",
    span: "lg:col-span-2",
  },
];

const MARQUEE_MODELS = [
  { name: "GPT 5.6 Sol", provider: "OpenAI" },
  { name: "Claude Opus 4.8", provider: "Anthropic" },
  { name: "GPT 5.6 Terra", provider: "OpenAI" },
  { name: "Claude Sonnet 5", provider: "Anthropic" },
  { name: "GPT 5.6 Luna", provider: "OpenAI" },
  { name: "Claude Opus 4.7", provider: "Anthropic" },
  { name: "GPT 5.5", provider: "OpenAI" },
  { name: "Claude Sonnet 4.6", provider: "Anthropic" },
] as const;

/** OpenAI's mono mark inherits this tint; Claude ships its own brand color. */
function providerTint(provider: string) {
  return provider === "Anthropic" ? "" : "text-white/80";
}

const ROUTER_MODELS = [
  { name: "GPT 5.6 Sol", provider: "OpenAI", io: "$5 / $30" },
  { name: "Claude Opus 4.8", provider: "Anthropic", io: "$5 / $25" },
  { name: "Claude Sonnet 5", provider: "Anthropic", io: "$2 / $10" },
  { name: "GPT 5.6 Luna", provider: "OpenAI", io: "$1 / $6" },
] as const;

const STORE = [
  {
    name: "AI Router credit",
    detail: "Pay-as-you-go voucher you redeem in the dashboard",
    price: "Rp10.000 = $25",
  },
  {
    name: "ChatGPT Plus",
    detail: "1 month of a verified account",
    price: "Rp25.000",
  },
  {
    name: "Kiro dev account",
    detail: "Pre-order for the spec-driven agentic IDE",
    price: "Coming soon",
  },
] as const;

const STATS = [
  { value: "8+", label: "Models" },
  { value: "2", label: "Providers" },
  { value: "1M+", label: "Context tokens" },
  { value: "4", label: "Tools" },
] as const;

export default function Home() {
  return (
    <div className={`${figtree.className} flex flex-1 flex-col tracking-[0]`}>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/[0.08]">
          {/* Ambient backdrop */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(110%_75%_at_50%_0%,#000_30%,transparent_72%)]" />
            <div className="hero-glow absolute -top-44 left-1/2 h-[480px] w-[860px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(62,207,142,0.16),transparent)]" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-16 sm:px-8 sm:pt-24 sm:pb-24">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              {/* Announcement pill → /ai */}
              <Link
                href="/ai"
                className="rise-in group inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] py-1 pl-1.5 pr-3 text-[13px] text-white/70 transition-colors hover:border-[#3ecf8e]/30 hover:text-white"
              >
                <span className="inline-flex items-center rounded-full bg-[#3ecf8e]/12 px-2 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
                  New
                </span>
                GPT 5.6 &amp; Claude Opus 4.8 live on the router
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>

              <h1
                className="rise-in mt-8 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-balance text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-transparent sm:text-6xl lg:text-7xl"
                style={{ animationDelay: "60ms" }}
              >
                One Hub For Every Model
              </h1>

              <p
                className="rise-in mt-6 text-pretty text-base text-white/70 sm:text-lg"
                style={{ animationDelay: "120ms" }}
              >
                One{" "}
                <Link
                  href="/ai"
                  className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
                >
                  key
                </Link>
                ,{" "}
                <Link
                  href="/ai"
                  className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
                >
                  pay as you go
                </Link>
                , no subscriptions.
              </p>

              <div
                className="rise-in mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
                style={{ animationDelay: "180ms" }}
              >
                <Button
                  size="lg"
                  className="shadow-[0_0_28px_rgba(62,207,142,0.3)]"
                  asChild
                >
                  <Link href="/ai">Get an API key</Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/tools">
                    Explore the tools
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>

              {/* Stats strip */}
              <dl
                className="rise-in mt-16 grid w-full grid-cols-2 gap-y-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-8 backdrop-blur-sm sm:mt-20 sm:grid-cols-4 sm:gap-y-0 sm:py-10"
                style={{ animationDelay: "260ms" }}
              >
                {STATS.map((stat, i) => (
                  <div
                    key={stat.label}
                    className={`flex flex-col items-center gap-1 ${
                      i > 0 ? "sm:border-l sm:border-white/[0.08]" : ""
                    }`}
                  >
                    <dd className="order-1 text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
                      {stat.value}
                    </dd>
                    <dt className="order-2 text-[13px] text-white/50">
                      {stat.label}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Router console: how to call the base URL */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
            <Reveal>
              <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#171717] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]">
                <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="ml-2 inline-flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-white/35">
                    <Terminal className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{BASE_URL}</span>
                  </span>
                  <span
                    className="rise-in ml-auto inline-flex items-center rounded-full bg-[#3ecf8e]/10 px-2 py-0.5 text-[11px] font-medium text-[#3ecf8e]"
                    style={{ animationDelay: "2300ms" }}
                  >
                    200 OK
                  </span>
                </div>
                <div className="grid gap-0 sm:grid-cols-2">
                  <pre className="overflow-x-auto border-b border-white/[0.06] p-4 text-[12.5px] leading-relaxed sm:border-b-0 sm:border-r">
                    <code className="font-mono text-white/80">
                      <span className="text-white/40">$ </span>BASE=
                      <span className="text-[#3ecf8e]">{BASE_URL}</span>
                      {"\n"}
                      <span className="text-white/40">$ </span>curl{" "}
                      <span className="text-[#3ecf8e]">$BASE</span>
                      /chat/completions \{"\n"}
                      {"  "}-H{" "}
                      <span className="text-[#7dd3fc]">
                        &quot;Authorization: Bearer $KEY&quot;
                      </span>{" "}
                      \{"\n"}
                      {"  "}-d{" "}
                      <span className="text-[#7dd3fc]">&apos;{"{"}</span>{" "}
                      <span className="text-[#c084fc]">&quot;model&quot;</span>:{" "}
                      <span className="text-[#3ecf8e]">
                        &quot;claude-opus-4.8&quot;
                      </span>
                      , … <span className="text-[#7dd3fc]">{"}"}&apos;</span>
                    </code>
                  </pre>
                  <div className="p-4 text-[12.5px] leading-relaxed">
                    <div className="flex items-center gap-2 text-white/35">
                      <Zap className="h-3.5 w-3.5 text-[#3ecf8e]" aria-hidden />
                      streaming claude-opus-4.8
                    </div>
                    <p className="mt-3 min-h-[3.75rem] font-mono text-white/80">
                      <TypedText text="One router, every model. Swap providers without touching a line of your code." />
                      <span className="term-cursor ml-0.5 inline-block h-3.5 w-[7px] translate-y-0.5 bg-[#3ecf8e]" />
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] text-white/45">
                      {["1,240 tokens", "$0.0086", "842ms"].map((stat, i) => (
                        <span
                          key={stat}
                          className="rise-in rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5"
                          style={{ animationDelay: `${2400 + i * 150}ms` }}
                        >
                          {stat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Base URL strip */}
                <div className="flex flex-col gap-2 border-t border-white/[0.08] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-white/40">
                    Base URL for any OpenAI SDK
                  </span>
                  <CopyValue value={BASE_URL} />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Model marquee */}
        <section className="border-b border-white/[0.08] bg-[#191919]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 sm:px-8">
            <Reveal>
              <p className="text-center text-[12px] uppercase tracking-wide text-white/35">
                One key reaches every model
              </p>
            </Reveal>
            <div className="marquee-mask relative flex overflow-hidden">
              <div className="marquee-track flex shrink-0 items-center gap-3 pr-3">
                {[...MARQUEE_MODELS, ...MARQUEE_MODELS].map((model, i) => (
                  <span
                    key={`${model.name}-${i}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 text-[13px] text-white/70"
                  >
                    <ProviderIcon
                      provider={model.provider}
                      className={`h-3.5 w-3.5 shrink-0 ${providerTint(model.provider)}`}
                    />
                    {model.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Tools bento → /tools */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
            <Reveal>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <span className="text-[12px] uppercase tracking-wide text-[#3ecf8e]">
                    The toolkit
                  </span>
                  <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                    A small set of tools, one place to run them
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-white/60">
                    Each tool stands on its own in the dashboard, sharing a
                    single account, key, and billing balance.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tools">
                    See all tools
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </Reveal>

            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {TOOLS.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <li key={tool.name} className={tool.span}>
                    <Reveal delay={i * 70} className="h-full">
                      <Link
                        href={tool.href}
                        className={`card-sheen group flex h-full flex-col rounded-xl border p-6 transition-all duration-200 hover:-translate-y-0.5 sm:p-7 ${
                          tool.accent
                            ? "border-[#3ecf8e]/25 bg-[#3ecf8e]/[0.05] hover:border-[#3ecf8e]/45"
                            : "border-white/[0.08] bg-[#1c1c1c] hover:border-white/20 hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e] transition-transform group-hover:scale-105"
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="text-[12px] uppercase tracking-wide text-white/40">
                            {tool.tag}
                          </span>
                        </div>
                        <h3 className="mt-5 flex items-center gap-1.5 text-lg font-medium text-white">
                          {tool.name}
                          <ArrowRight
                            className="h-4 w-4 -translate-x-1 text-white/40 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                            aria-hidden
                          />
                        </h3>
                        <p className="mt-2 text-[15px] leading-relaxed text-white/55">
                          {tool.blurb}
                        </p>
                      </Link>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* AI Router spotlight → /ai */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
                  <Waypoints className="h-3.5 w-3.5" aria-hidden />
                  AI Router
                </span>
                <h2 className="mt-5 text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                  One key, every model, pay per token
                </h2>
                <p className="mt-3 max-w-md text-base leading-relaxed text-white/60">
                  Point any OpenAI-compatible client at the router and switch
                  between Claude, GPT, and more without changing your code. Top
                  up credit and pay only for the tokens you use.
                </p>

                <ul className="mt-6 space-y-2.5">
                  {[
                    "Drop-in chat completions & embeddings",
                    "GPT and Claude on a single key",
                    "Per-call logs with tokens and cost",
                    "Top up with a voucher, billed in credit",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[15px] text-white/70"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#3ecf8e]"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button asChild>
                    <Link href="/ai">
                      Get a key
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/ai">See model pricing</Link>
                  </Button>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                  <span className="text-[13px] font-medium text-white">
                    Model pricing
                  </span>
                  <span className="rounded-md border border-[#3ecf8e]/15 bg-[#3ecf8e]/[0.06] px-2 py-0.5 text-[11px] font-medium text-[#3ecf8e]">
                    USD / M tokens
                  </span>
                </div>
                <table className="w-full text-left text-[13px]">
                  <tbody>
                    {ROUTER_MODELS.map((model) => (
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
                  See the full model list
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* AI Store cross-sell → /ai */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
            <Reveal>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-[#3ecf8e]">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    AI Store
                  </span>
                  <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                    AI products, ready to buy
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-white/60">
                    Router credit vouchers plus verified accounts, fulfilled and
                    ready to use.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/ai">
                    Visit the store
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </Reveal>

            <ul className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
              {STORE.map((item, i) => (
                <li key={item.name}>
                  <Reveal delay={i * 80} className="h-full">
                    <Link
                      href="/ai"
                      className="card-sheen group flex h-full flex-col justify-between gap-6 rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20"
                    >
                      <div>
                        <h3 className="text-lg font-medium text-white">
                          {item.name}
                        </h3>
                        <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                          {item.detail}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[15px] font-medium text-[#3ecf8e]">
                          {item.price}
                        </span>
                        <ArrowRight
                          className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </div>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

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
                    <h2 className="text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                      Start with one account
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-white/60">
                      Create an account to unlock the router, chat, VPS console,
                      and image studio, or read a bit about who I am first.
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
                      <Link href="/about">About me</Link>
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
