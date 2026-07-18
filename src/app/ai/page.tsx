import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  ExternalLink,
  Sparkles,
  Ticket,
  Waypoints,
} from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { CopyValue } from "@/components/ui/CopyValue";
import { ProviderIcon } from "@/components/ui/ProviderIcons";
import { Reveal } from "@/components/ui/Reveal";
import { ModelIdCopy } from "./ModelIdCopy";

const figtree = Figtree({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "AI Store",
  description:
    "AI products for sale: my own AI Router, plus verified ChatGPT Plus and Kiro dev accounts ordered directly via WhatsApp.",
};

const WHATSAPP_NUMBER = "6287889640714";

function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

const MARKETPLACE = {
  chatgptPlus: whatsappLink(
    "Hi, I want to order ChatGPT Plus (1 month, verified) — clicked from the AI Store page.",
  ),
  kiro: whatsappLink(
    "Hi, I want to pre-order a Kiro dev account — clicked from the AI Store page.",
  ),
  voucher: whatsappLink(
    "Hi, I want to buy an AI Router credit voucher — clicked from the AI Store page.",
  ),
};

const BASE_URL = "https://ai.yogathedev.com/v1";

const MODELS = [
  {
    name: "GPT 5.6 Sol",
    id: "gpt-5.6-sol",
    provider: "OpenAI",
    context: "1,050,000",
    input: "$5.00",
    output: "$30.00",
    available: true,
  },
  {
    name: "GPT 5.6 Terra",
    id: "gpt-5.6-terra",
    provider: "OpenAI",
    context: "1,050,000",
    input: "$2.50",
    output: "$15.00",
    available: true,
  },
  {
    name: "GPT 5.6 Luna",
    id: "gpt-5.6-luna",
    provider: "OpenAI",
    context: "1,050,000",
    input: "$1.00",
    output: "$6.00",
    available: true,
  },
  {
    name: "GPT 5.5",
    id: "gpt-5.5",
    provider: "OpenAI",
    context: "1,000,000",
    input: "$5.00",
    output: "$30.00",
    available: true,
  },
  {
    name: "Claude Sonnet 5",
    id: "claude-sonnet-5",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$2.00",
    output: "$10.00",
    available: true,
  },
  {
    name: "Claude Opus 4.8",
    id: "claude-opus-4.8",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$5.00",
    output: "$25.00",
    available: true,
  },
  {
    name: "Claude Opus 4.7",
    id: "claude-opus-4.7",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$5.00",
    output: "$25.00",
    available: true,
  },
  {
    name: "Claude Sonnet 4.6",
    id: "claude-sonnet-4.6",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$3.00",
    output: "$15.00",
    available: true,
  },
];

type Product = {
  icon: typeof Waypoints;
  name: string;
  tag: string;
  blurb: string;
  highlights: string[];
  price: string;
  cta: string;
  href: string;
  external: boolean;
  comingSoon?: boolean;
  secondaryCta?: string;
  secondaryHref?: string;
};

const PRODUCTS: Product[] = [
  {
    icon: Waypoints,
    name: "AI Router",
    tag: "Built in-house",
    blurb:
      "One OpenAI-compatible key for GPT and Claude. Top up credit and pay only for the tokens you use.",
    highlights: [
      "OpenAI-compatible endpoint",
      "GPT & Claude on one key",
      "Pay-as-you-go credit",
    ],
    price: "Pay as you go",
    cta: "Get a key",
    href: "/dashboard/ai",
    external: false,
    secondaryCta: "Buy voucher",
    secondaryHref: MARKETPLACE.voucher,
  },
  {
    icon: Sparkles,
    name: "ChatGPT Plus",
    tag: "1 month, verified",
    blurb:
      "A verified ChatGPT Plus account for one month: faster responses, priority access, and the latest models.",
    highlights: ["Verified account", "1 month access", "Latest OpenAI models"],
    price: "Rp25.000",
    cta: "Buy now",
    href: MARKETPLACE.chatgptPlus,
    external: true,
  },
  {
    icon: Bot,
    name: "Kiro",
    tag: "Pre-order dev account",
    blurb:
      "Pre-order a Kiro dev account: the agentic IDE for spec-driven development. Reserve yours ahead of release.",
    highlights: [
      "Dev account",
      "Spec-driven agentic IDE",
      "Pre-release reservation",
    ],
    price: "Rp80.000",
    cta: "Pre-order",
    href: MARKETPLACE.kiro,
    external: true,
  },
];

export default function AiStore() {
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
            <span className="rise-in inline-flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-[#3ecf8e]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI Store
            </span>

            <h1
              className="rise-in mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              AI products, ready to use.
            </h1>

            <p
              className="rise-in mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              My own AI Router, plus verified ChatGPT Plus and Kiro dev
              accounts, ordered directly via WhatsApp.
            </p>
          </div>
        </section>

        {/* Catalog */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 sm:py-16">
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PRODUCTS.map((product, i) => {
                const Icon = product.icon;
                return (
                  <li key={product.name}>
                    <Reveal delay={i * 80} className="h-full">
                      <div className="card-sheen group flex h-full flex-col rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 sm:p-7">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e] transition-transform group-hover:scale-105"
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="text-[12px] uppercase tracking-wide text-white/40">
                            {product.tag}
                          </span>
                        </div>

                        <h2 className="mt-5 text-xl font-semibold text-white">
                          {product.name}
                        </h2>
                        <p className="mt-2 text-[15px] leading-relaxed text-white/55">
                          {product.blurb}
                        </p>

                        <ul className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5 text-[13px] text-white/60">
                          {product.highlights.map((item) => (
                            <li key={item} className="flex items-center gap-2">
                              <Check
                                className="h-3.5 w-3.5 shrink-0 text-[#3ecf8e]"
                                aria-hidden
                              />
                              {item}
                            </li>
                          ))}
                        </ul>

                        <div className="mt-6 flex-1" />

                        <div className="text-[15px] font-semibold text-[#3ecf8e]">
                          {product.price}
                        </div>

                        <div className="mt-4 flex gap-2">
                          {product.comingSoon ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              disabled
                            >
                              {product.cta}
                            </Button>
                          ) : product.external ? (
                            <Button size="sm" className="flex-1" asChild>
                              <a
                                href={product.href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {product.cta}
                                <ExternalLink aria-hidden />
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" className="flex-1" asChild>
                              <Link href={product.href}>
                                {product.cta}
                                <ArrowRight aria-hidden />
                              </Link>
                            </Button>
                          )}

                          {product.secondaryHref && product.secondaryCta && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              asChild
                            >
                              <a
                                href={product.secondaryHref}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {product.secondaryCta}
                                <ExternalLink aria-hidden />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ul>

            <p className="mt-8 text-[13px] leading-relaxed text-white/40">
              ChatGPT Plus and Kiro orders go through WhatsApp and open in a
              new tab. AI Router is run in-house from the dashboard.
            </p>
          </div>
        </section>

        {/* AI Router model pricing */}
        <section id="models" className="scroll-mt-20 border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 sm:py-16">
            <Reveal>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
                    <Waypoints className="h-3.5 w-3.5" aria-hidden />
                    AI Router
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
                    Model pricing
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-white/60">
                    Pay per token, billed in credit. No subscription, only pay
                    for what you use.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#3ecf8e]/15 bg-[#3ecf8e]/[0.06] px-4 py-3">
                  <span className="text-[11px] uppercase tracking-wide text-white/40">
                    Top-up rate
                  </span>
                  <span className="text-[15px] font-semibold text-[#3ecf8e]">
                    Rp 10.000 = $25
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
                  Top up by redeeming a voucher ordered via{" "}
                  <a
                    href={MARKETPLACE.voucher}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
                  >
                    WhatsApp
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
              <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
                <table className="w-full table-fixed text-left text-[13px] sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-white/40">
                      <th className="w-[30%] px-4 py-3 font-medium sm:w-[24%] sm:px-5">
                        Model
                      </th>
                      <th className="w-[26%] px-4 py-3 font-medium sm:w-[22%] sm:px-5">
                        Model ID
                      </th>
                      <th className="hidden w-[16%] px-5 py-3 font-medium sm:table-cell">
                        Context
                      </th>
                      <th className="w-[24%] px-4 py-3 text-right font-medium sm:w-[20%] sm:px-5">
                        In / Out
                        <span className="text-white/25"> /M</span>
                      </th>
                      <th className="w-[20%] px-4 py-3 text-right font-medium sm:w-[18%] sm:px-5">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODELS.map((model) => (
                      <tr
                        key={model.name}
                        className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3.5 font-medium text-white sm:px-5">
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
                        <td className="px-4 py-3.5 sm:px-5">
                          <ModelIdCopy id={model.id} />
                        </td>
                        <td className="hidden px-5 py-3.5 text-white/60 sm:table-cell">
                          {model.context}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-white/60 sm:px-5">
                          {model.input} / {model.output}
                        </td>
                        <td className="px-4 py-3.5 text-right sm:px-5">
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium sm:px-2.5 sm:text-[12px] ${
                              model.available
                                ? "border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]"
                                : "border-white/[0.08] bg-white/[0.03] text-white/40"
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 rounded-full ${
                                model.available ? "bg-[#3ecf8e]" : "bg-white/30"
                              }`}
                            />
                            {model.available ? "Available" : "Not available"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                        href={MARKETPLACE.voucher}
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
