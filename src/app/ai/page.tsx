import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Link from "next/link";
import { ArrowRight, ExternalLink, Ticket, Waypoints } from "lucide-react";

import { aiDb } from "@/lib/db/ai";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { CopyValue } from "@/components/ui/CopyValue";
import { ProviderIcon } from "@/components/ui/ProviderIcons";
import { Reveal } from "@/components/ui/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { ModelTable, type PricingModel } from "./ModelTable";

const figtree = Figtree({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = pageMetadata({
  title: "AI Router — Model pricing",
  description:
    "Pay-per-token pricing for the AI Router: GPT and Claude on one OpenAI-compatible key. Top up with credit, no subscription, only pay for what you use.",
  path: "/ai",
  keywords: [
    "AI router pricing",
    "OpenAI-compatible API key",
    "GPT and Claude API pricing",
    "pay as you go AI",
    "token pricing",
    "AI credit voucher",
  ],
});

const VOUCHER_LINK =
  "https://marketku.id/ai/product/ai-router-opus-4-8-sonnet-5-dan-gpt-5-6-c10f5333-679c-405b-a4bc-f746e318bf46";

const BASE_URL = "https://ai.yogathedev.com/v1";

// Re-render at most every 5 minutes so model availability tracks the router
// without querying its database on every visit (same cadence as the landing page).
export const revalidate = 300;

/**
 * Model IDs the router can actually serve right now: enabled in
 * `enabledModels` under a provider that is itself in `enabledProviders`.
 * Returns an empty set on failure so every model falls back to
 * "Not available" rather than promising capacity we can't confirm.
 */
async function getEnabledModelIds(): Promise<Set<string>> {
  try {
    const [providers, models] = await Promise.all([
      aiDb.enabledProviders.findMany({ select: { providerAlias: true } }),
      aiDb.enabledModels.findMany({
        select: { providerAlias: true, modelId: true },
      }),
    ]);
    const enabledProviders = new Set(providers.map((p) => p.providerAlias));
    return new Set(
      models
        .filter((m) => enabledProviders.has(m.providerAlias))
        .map((m) => m.modelId),
    );
  } catch {
    return new Set();
  }
}

/**
 * Models the `auto` combo tries, in order — the router moves to the next one
 * when the previous errors. Ids drive its availability badge, names are what
 * the page shows.
 */
const AUTO_CHAIN = [
  { id: "claude-opus-5", name: "Claude Opus 5", provider: "Anthropic" },
  { id: "gpt-5.6-sol", name: "GPT 5.6 Sol", provider: "OpenAI" },
  { id: "kimi-k3", name: "Kimi K3", provider: "Moonshot AI" },
] as const;

/**
 * Context windows in tokens and prices in USD per million tokens — kept
 * numeric so the table can sort on them and format at render time. A null
 * price means the row bills at whatever model its fallback chain lands on.
 */
const MODELS: Omit<PricingModel, "available">[] = [
  {
    name: "Auto",
    id: "auto",
    provider: "Fallback chain",
    // Every model in the chain carries at least a 1M window.
    context: 1_000_000,
    input: null,
    output: null,
    fallback: AUTO_CHAIN.map((m) => m.name),
  },
  {
    name: "GPT 6 Astra",
    id: "gpt-6-astra",
    provider: "OpenAI",
    context: 1_050_000,
    input: 10,
    output: 50,
  },
  {
    name: "GPT 5.6 Sol",
    id: "gpt-5.6-sol",
    provider: "OpenAI",
    context: 1_050_000,
    input: 5,
    output: 30,
  },
  {
    name: "GPT 5.6 Terra",
    id: "gpt-5.6-terra",
    provider: "OpenAI",
    context: 1_050_000,
    input: 2.5,
    output: 15,
  },
  {
    name: "GPT 5.6 Luna",
    id: "gpt-5.6-luna",
    provider: "OpenAI",
    context: 1_050_000,
    input: 1,
    output: 6,
  },
  {
    name: "GPT 5.5",
    id: "gpt-5.5",
    provider: "OpenAI",
    context: 1_000_000,
    input: 5,
    output: 30,
  },
  {
    name: "Claude Fable 5",
    id: "claude-fable-5",
    provider: "Anthropic",
    context: 1_000_000,
    input: 10,
    output: 50,
  },
  {
    name: "Claude Sonnet 5",
    id: "claude-sonnet-5",
    provider: "Anthropic",
    context: 1_000_000,
    input: 2,
    output: 10,
  },
  {
    name: "Claude Opus 5",
    id: "claude-opus-5",
    provider: "Anthropic",
    context: 1_000_000,
    input: 5,
    output: 25,
  },
  {
    name: "Kimi K3",
    id: "kimi-k3",
    provider: "Moonshot AI",
    context: 1_000_000,
    input: 2.5,
    output: 14,
  },
  {
    name: "GLM 5.3",
    id: "glm-5.3",
    provider: "Z.ai",
    context: 1_000_000,
    input: 1.5,
    output: 4,
  },
  {
    name: "DeepSeek V4 Pro",
    id: "deepseek-v4-pro",
    provider: "DeepSeek",
    context: 1_000_000,
    input: 0.435,
    output: 0.87,
  },
  {
    name: "DeepSeek V4.1 Flash",
    id: "deepseek-v4.1-flash",
    provider: "DeepSeek",
    context: 1_000_000,
    input: 0.15,
    output: 0.6,
  },
  {
    name: "DeepSeek V4 Flash",
    id: "deepseek-v4-flash",
    provider: "DeepSeek",
    context: 1_000_000,
    input: 0.09,
    output: 0.18,
  },
  {
    name: "MiniMax M3",
    id: "minimax-m3",
    provider: "MiniMax",
    context: 1_000_000,
    input: 0.3,
    output: 1.2,
  },
  {
    name: "Qwen3.8 Max",
    id: "qwen3.8-max",
    provider: "Qwen",
    context: 1_000_000,
    input: 2,
    output: 6,
  },
];

export default async function AiRouterPricing() {
  const enabledModelIds = await getEnabledModelIds();
  const models = MODELS.map((model) => ({
    ...model,
    // A fallback combo still serves traffic as long as one of its legs is up.
    available: model.fallback
      ? AUTO_CHAIN.some((m) => enabledModelIds.has(m.id))
      : enabledModelIds.has(model.id),
  }));
  return (
    <div className={`${figtree.className} flex flex-1 flex-col tracking-[0]`}>
      <JsonLd
        schema={breadcrumbSchema([{ name: "AI Router", path: "/ai" }])}
      />
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="hero-glow absolute -top-40 left-1/2 h-[400px] w-[760px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(62,207,142,0.12),transparent)]" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 pt-14 pb-14 sm:px-8 sm:pt-20 sm:pb-16">
            <span className="rise-in inline-flex items-center gap-1.5 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
              <Waypoints className="h-3.5 w-3.5" aria-hidden />
              AI Router
            </span>

            <h1
              className="rise-in mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              Model pricing
            </h1>

            <p
              className="rise-in mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              One OpenAI-compatible key for GPT and Claude. Pay per token,
              billed in credit — no subscription, only pay for what you use.
            </p>
          </div>
        </section>

        {/* Model pricing */}
        <section id="models" className="scroll-mt-20">
          <div className="mx-auto w-full max-w-6xl px-6 pb-12 sm:px-8 sm:pb-16">
            <Reveal>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl">
                  Per-token rates
                </h2>
                <div className="flex shrink-0 items-center gap-3 self-start rounded-lg border border-[#3ecf8e]/15 bg-[#3ecf8e]/[0.06] px-4 py-3 sm:self-auto">
                  <span className="text-[11px] uppercase tracking-wide text-white/40">
                    Top-up rate
                  </span>
                  <span className="text-[15px] font-semibold text-[#3ecf8e]">
                    Rp 15.000 = $25
                  </span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
                <Ticket
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#3ecf8e]"
                  aria-hidden
                />
                <p className="text-[13px] leading-relaxed text-white/55">
                  Top up by redeeming a voucher ordered from the{" "}
                  <a
                    href={VOUCHER_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
                  >
                    store
                  </a>
                  . Purchase a credit voucher, then redeem its code in the
                  dashboard to add balance instantly.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-[#171717] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[11px] uppercase tracking-wide text-white/40">
                  Base URL for any OpenAI SDK
                </span>
                <CopyValue value={BASE_URL} />
              </div>
            </Reveal>

            <Reveal delay={140}>
              <div className="mt-4 rounded-lg border border-[#3ecf8e]/15 bg-[#3ecf8e]/[0.04] px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <Waypoints
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#3ecf8e]"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-relaxed text-white/55">
                      <code className="rounded border border-white/[0.08] bg-[#171717] px-1.5 py-0.5 font-mono text-[12px] text-white">
                        auto
                      </code>{" "}
                      is a fallback combo: one model ID that steps to the next
                      model when the previous one errors. You are billed at the
                      rate of whichever model answers.
                    </p>
                    <ol className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      {AUTO_CHAIN.map((model, index) => (
                        <li key={model.id} className="flex items-center gap-2">
                          {index > 0 && (
                            <ArrowRight
                              className="h-3.5 w-3.5 shrink-0 text-white/25"
                              aria-hidden
                            />
                          )}
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#171717] px-2 py-1 text-[12px] text-white/75">
                            <ProviderIcon
                              provider={model.provider}
                              className={`h-3.5 w-3.5 shrink-0 ${
                                model.provider === "Anthropic"
                                  ? ""
                                  : "text-white/80"
                              }`}
                            />
                            {model.name}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              <ModelTable models={models} />

              <p className="mt-4 text-[12px] text-white/35">
                Prices shown in USD per million tokens.
              </p>
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
                    <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
                      Make your first call in minutes
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-white/60">
                      Grab a key, point your SDK at the base URL, and pay only
                      for the tokens you use.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button size="lg" asChild>
                      <Link href="/dashboard/ai">
                        Get a key
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                    <Button size="lg" variant="secondary" asChild>
                      <a
                        href={VOUCHER_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Buy a voucher
                        <ExternalLink aria-hidden />
                      </a>
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
