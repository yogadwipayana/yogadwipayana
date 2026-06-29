import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  ExternalLink,
  Sparkles,
  Ticket,
  Waypoints,
} from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ModelIdCopy } from "./ModelIdCopy";

export const metadata: Metadata = {
  title: "AI Store",
  description:
    "AI products for sale — my own AI Router, plus verified ChatGPT Plus and Kiro dev accounts fulfilled through Marketku.",
};

const MARKETPLACE = {
  chatgptPlus:
    "https://marketku.id/chatgpt/product/chatgpt-plus-1-bulan-sudah-verif-ea6de138-5e57-4dbb-8cba-0623b18321fd",
  kiro: "https://marketku.id/kiro/product/pre-order-akun-kiro-dev-37f174fe-5ef7-41f3-a93d-c30e460daa0d",
  voucher: "https://marketku.id/u/yogathedev-store",
};

const BASE_URL = "https://ai.yogathedev.com/v1";

const MODELS = [
  {
    name: "GPT-5.5",
    id: "gpt-5.5",
    provider: "OpenAI",
    context: "1,000,000",
    input: "$5.00",
    output: "$30.00",
  },
  {
    name: "Claude Opus 4.8",
    id: "claude-opus-4.8",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$5.00",
    output: "$25.00",
  },
  {
    name: "Claude Opus 4.7",
    id: "claude-opus-4.7",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$5.00",
    output: "$25.00",
  },
  {
    name: "Claude Sonnet 4.6",
    id: "claude-sonnet-4.6",
    provider: "Anthropic",
    context: "1,000,000",
    input: "$3.00",
    output: "$15.00",
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
    tag: "1 month · verified",
    blurb:
      "A verified ChatGPT Plus account for one month — faster responses, priority access, and the latest models.",
    highlights: [
      "Verified account",
      "1 month access",
      "Latest OpenAI models",
    ],
    price: "Rp45.000",
    cta: "Buy now",
    href: MARKETPLACE.chatgptPlus,
    external: true,
  },
  {
    icon: Bot,
    name: "Kiro",
    tag: "Pre-order · dev account",
    blurb:
      "Pre-order a Kiro dev account — the agentic IDE for spec-driven development. Reserve yours ahead of release.",
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
    <>
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 pt-10 pb-10 sm:px-8 sm:pt-14 sm:pb-12 lg:pt-16">
            <span className="inline-flex items-center rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
              AI Store
            </span>

            <h1 className="mt-5 max-w-2xl text-balance text-4xl font-medium leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl">
              AI products, ready to use.
            </h1>

            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
              My own AI Router, plus verified ChatGPT Plus and Kiro dev accounts
              — fulfilled through Marketku.
            </p>
          </div>
        </section>

        {/* Catalog */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 sm:py-16">
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {PRODUCTS.map((product) => {
                const Icon = product.icon;
                return (
                  <li
                    key={product.name}
                    className="flex flex-col rounded-xl border border-white/[0.08] bg-[#1c1c1c] p-6 transition-colors hover:border-white/15 sm:p-7"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#3ecf8e]"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-[12px] uppercase tracking-wide text-white/40">
                        {product.tag}
                      </span>
                    </div>

                    <h2 className="mt-5 text-xl font-medium text-white">
                      {product.name}
                    </h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/55">
                      {product.blurb}
                    </p>

                    <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-5 text-[13px] text-white/60">
                      {product.highlights.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="h-1 w-1 shrink-0 rounded-full bg-[#3ecf8e]"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex-1" />

                    <div className="text-[15px] font-medium text-white">
                      {product.price}
                    </div>

                    <div className="mt-4 flex gap-2">
                      {product.external ? (
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
                  </li>
                );
              })}
            </ul>

            <p className="mt-8 text-[13px] leading-relaxed text-white/40">
              ChatGPT Plus and Kiro are fulfilled via Marketku and open in a new
              tab. AI Router is run in-house from the dashboard.
            </p>
          </div>
        </section>

        {/* AI Router model pricing */}
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 sm:py-16">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex items-center rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
                  AI Router
                </span>
                <h2 className="mt-4 text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">
                  Model pricing
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/60">
                  Pay per token, billed in credit. No subscription — only pay
                  for what you use.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#3ecf8e]/15 bg-[#3ecf8e]/[0.06] px-4 py-3">
                <span className="text-[11px] uppercase tracking-wide text-white/40">
                  Top-up rate
                </span>
                <span className="text-[15px] font-medium text-[#3ecf8e]">
                  Rp 10.000 = $25
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
              <Ticket
                className="mt-0.5 h-4 w-4 shrink-0 text-[#3ecf8e]"
                aria-hidden
              />
              <p className="text-[13px] leading-relaxed text-white/55">
                Top up by redeeming a voucher bought from{" "}
                <a
                  href="https://marketku.id/u/yogathedev-store"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
                >
                  Marketku
                </a>
                . Purchase a credit voucher, then redeem its code in the
                dashboard to add balance instantly.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-1.5 rounded-lg border border-white/[0.08] bg-[#171717] px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-[11px] uppercase tracking-wide text-white/40">
                Base URL
              </span>
              <code className="font-mono text-[13px] text-[#3ecf8e]">
                {BASE_URL}
              </code>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08]">
              <table className="w-full text-left text-[13px] sm:text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-white/40">
                    <th className="px-4 py-3 font-medium sm:px-5">Model</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Model ID</th>
                    <th className="hidden px-5 py-3 font-medium sm:table-cell">
                      Context
                    </th>
                    <th className="px-4 py-3 text-right font-medium sm:px-5">
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
                      <td className="px-4 py-3.5 font-medium text-white sm:px-5">
                        {model.name}
                        <span className="mt-0.5 block text-[12px] font-normal text-white/40">
                          {model.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 sm:px-5">
                        <ModelIdCopy id={model.id} />
                      </td>
                      <td className="hidden px-5 py-3.5 text-white/60 sm:table-cell">
                        {model.context}
                      </td>
                      <td className="px-4 py-3.5 text-right text-white/60 sm:px-5">
                        {model.input} / {model.output}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-[12px] text-white/35">
              Prices shown in USD per million tokens.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
