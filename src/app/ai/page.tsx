import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, ExternalLink, Sparkles, Waypoints } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "AI Store",
  description:
    "AI products for sale — my own AI Router, plus verified ChatGPT Plus and Kiro dev accounts fulfilled through Marketku.",
};

const MARKETPLACE = {
  chatgptPlus:
    "https://marketku.id/chatgpt/product/chatgpt-plus-1-bulan-sudah-verif-ea6de138-5e57-4dbb-8cba-0623b18321fd",
  kiro: "https://marketku.id/kiro/product/pre-order-akun-kiro-dev-37f174fe-5ef7-41f3-a93d-c30e460daa0d",
};

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

                    <div className="mt-4">
                      {product.external ? (
                        <Button size="sm" className="w-full" asChild>
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
                        <Button size="sm" className="w-full" asChild>
                          <Link href={product.href}>
                            {product.cta}
                            <ArrowRight aria-hidden />
                          </Link>
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
      </main>

      <Footer />
    </>
  );
}
