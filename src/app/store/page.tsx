import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  Cpu,
  ExternalLink,
  Infinity as InfinityIcon,
  Smartphone,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { formatIdr } from "@/lib/money";
import { SMS_PRICE_IDR } from "@/lib/sms-order";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";

const figtree = Figtree({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = pageMetadata({
  title: "AI Store",
  description:
    "In-house tools — my AI Router and disposable SMS verification — plus verified ChatGPT Plus and Kiro dev accounts ordered via WhatsApp.",
  path: "/store",
  keywords: [
    "AI router",
    "OpenAI-compatible API key",
    "SMS OTP number",
    "OpenAI verification number",
    "buy ChatGPT Plus",
    "Kiro dev account",
    "AI credit voucher",
    "GPT and Claude access",
    "pay as you go AI",
  ],
});

const MARKETPLACE = {
  chatgptPlus:
    "https://marketku.id/chatgpt/product/chatgpt-plus-private-1-bulan-bergaransi-support-codex-ea6de138-5e57-4dbb-8cba-0623b18321fd",
  kiro: "https://marketku.id/kiro/product/kiro-pro-bergaransi-9f7731d0-3215-44b3-8e9f-fd0dbb9e4bc1",
  smsVerif:
    "https://marketku.id/jasa-verif/product/jasa-verif-codex-bbcd9849-26d1-4c51-b1b2-cd5ab2eb0170",
  voucher:
    "https://marketku.id/ai/product/ai-router-opus-4-8-sonnet-5-dan-gpt-5-6-c10f5333-679c-405b-a4bc-f746e318bf46",
};

/** Marketku listing for the frontier Router API (unlimited, fair-use plans). */
const ROUTER_API_URL =
  "https://marketku.id/ai/product/api-model-frontier-opus-4-8-sonnet-5-dan-gpt-5-6-sol-terra-luna-a4bf07d2-85a0-49ed-a9b8-766703a9c75e";

/**
 * Fair-use token allowance per unlimited-plan duration, taken from the
 * Marketku listing. "Avg / day" is derived (total ÷ days) as a value cue.
 */
const ROUTER_PLANS = [
  { duration: "1 day", tokens: "10M tokens", perDay: "10M / day" },
  { duration: "3 days", tokens: "50M tokens", perDay: "~16.7M / day" },
  { duration: "7 days", tokens: "100M tokens", perDay: "~14.3M / day" },
];

type Product = {
  icon: typeof Waypoints;
  name: string;
  tag: string;
  blurb: string;
  highlights: string[];
  /** Prominent price line — a figure ("Rp25.000") or a model ("Pay as you go"). */
  price: string;
  /** Muted caption under the price. */
  unit: string;
  cta: string;
  href: string;
  external: boolean;
  secondaryCta?: string;
  secondaryHref?: string;
};

/** Tools run in-house and opened straight from the dashboard. */
const IN_HOUSE: Product[] = [
  {
    icon: Waypoints,
    name: "AI Router",
    tag: "AI Router",
    blurb:
      "One OpenAI-compatible key for GPT and Claude. Top up credit and pay only for the tokens you use.",
    highlights: [
      "OpenAI-compatible endpoint",
      "GPT & Claude on one key",
      "Pay-as-you-go credit",
      "Redeem voucher codes",
    ],
    price: "Pay as you go",
    unit: "Top up credit · billed per token",
    cta: "Open dashboard",
    href: "/dashboard/ai",
    external: false,
    secondaryCta: "Buy voucher",
    secondaryHref: MARKETPLACE.voucher,
  },
  {
    icon: Smartphone,
    name: "SMS Verification",
    tag: "OTP numbers",
    blurb:
      "Rent a disposable number and pull the OpenAI verification code for Codex sign-up. Charged only when a code lands.",
    highlights: [
      "Disposable phone number",
      "OpenAI / Codex OTP",
      "Reusable for ~120 hours",
      "Refunded if no code arrives",
    ],
    price: formatIdr(SMS_PRICE_IDR),
    unit: "per number · pay from wallet",
    cta: "Get a number",
    href: "/dashboard/sms",
    external: false,
    secondaryCta: "Buy on Marketku",
    secondaryHref: MARKETPLACE.smsVerif,
  },
];

/** Accounts and access ordered through the marketplace or WhatsApp. */
const MARKETPLACE_PRODUCTS: Product[] = [
  {
    icon: Cpu,
    name: "API Model Frontier",
    tag: "Frontier API",
    blurb:
      "Instant API access to the frontier line-up — Claude Opus 4.8, Sonnet 5, and GPT-5.6 Sol, Terra & Luna — on one pay-as-you-go key.",
    highlights: [
      "Claude Opus 4.8 & Sonnet 5",
      "GPT-5.6 Sol, Terra & Luna",
      "One OpenAI-compatible key",
    ],
    price: "Pay as you go",
    unit: "One OpenAI-compatible key",
    cta: "Buy on Marketku",
    href: ROUTER_API_URL,
    external: true,
  },
  {
    icon: Sparkles,
    name: "ChatGPT Plus",
    tag: "1 month · verified",
    blurb:
      "A verified ChatGPT Plus account for one month: faster responses, priority access, and the latest models.",
    highlights: ["Verified account", "1 month access", "Codex support"],
    price: "Rp25.000",
    unit: "1 month · warranty",
    cta: "Buy on Marketku",
    href: MARKETPLACE.chatgptPlus,
    external: true,
  },
  {
    icon: Bot,
    name: "Kiro Pro",
    tag: "Pro · warranty",
    blurb:
      "A Kiro Pro account for the spec-driven agentic IDE — warranted and ready to use.",
    highlights: [
      "Kiro Pro account",
      "Spec-driven agentic IDE",
      "Warranty included",
    ],
    price: "Rp80.000",
    unit: "Kiro Pro · warranty",
    cta: "Buy on Marketku",
    href: MARKETPLACE.kiro,
    external: true,
  },
];

function ProductCtas({ product }: { product: Product }) {
  return (
    <div className="mt-5 flex gap-2">
      {product.external ? (
        <Button size="sm" className="flex-1" asChild>
          <a href={product.href} target="_blank" rel="noopener noreferrer">
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
        <Button size="sm" variant="outline" className="flex-1" asChild>
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
  );
}

/** Flagship card for the in-house tools — larger, with a 2×2 feature grid. */
function InHouseCard({ product, index }: { product: Product; index: number }) {
  const Icon = product.icon;
  return (
    <Reveal delay={index * 80} className="h-full">
      <div className="card-sheen group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1c1c] p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full [background:radial-gradient(closest-side,rgba(62,207,142,0.10),transparent)]"
        />

        <div className="relative flex items-start justify-between gap-3">
          <span
            aria-hidden
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.08] text-[#3ecf8e] transition-transform group-hover:scale-105"
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/45">
            {product.tag}
          </span>
        </div>

        <h3 className="relative mt-6 text-2xl font-semibold tracking-[-0.01em] text-white">
          {product.name}
        </h3>
        <p className="relative mt-2.5 text-[15px] leading-relaxed text-white/55">
          {product.blurb}
        </p>

        <ul className="relative mt-6 grid gap-2.5 text-[13px] text-white/60 sm:grid-cols-2">
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

        <div className="relative mt-auto pt-7">
          <div className="border-t border-white/[0.06] pt-5">
            <div className="text-xl font-semibold text-white">
              {product.price}
            </div>
            <div className="mt-0.5 text-[12px] text-white/40">
              {product.unit}
            </div>
          </div>
          <ProductCtas product={product} />
        </div>
      </div>
    </Reveal>
  );
}

/** Compact card for marketplace accounts. */
function AccessCard({ product, index }: { product: Product; index: number }) {
  const Icon = product.icon;
  return (
    <Reveal delay={index * 80} className="h-full">
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

        <h3 className="mt-5 text-lg font-semibold text-white">
          {product.name}
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-white/55">
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

        <div className="mt-auto pt-6">
          <div className="text-[15px] font-semibold text-white">
            {product.price}
          </div>
          <div className="mt-0.5 text-[12px] text-white/40">{product.unit}</div>
          <ProductCtas product={product} />
        </div>
      </div>
    </Reveal>
  );
}

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <Reveal>
      <div className="flex items-center gap-4">
        <h2 className="shrink-0 text-lg font-semibold text-white">{title}</h2>
        <span aria-hidden className="h-px flex-1 bg-white/[0.07]" />
        <span className="shrink-0 text-[12px] text-white/35">{note}</span>
      </div>
    </Reveal>
  );
}

export default function AiStore() {
  return (
    <div className={`${figtree.className} flex flex-1 flex-col tracking-[0]`}>
      <JsonLd schema={breadcrumbSchema([{ name: "AI Store", path: "/store" }])} />
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden">
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
              In-house tools like my AI Router and disposable SMS verification,
              plus verified ChatGPT Plus and Kiro dev accounts ordered directly
              via WhatsApp.
            </p>

            <div
              className="rise-in mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/45"
              style={{ animationDelay: "180ms" }}
            >
              {["Pay-as-you-go", "No subscription", "Instant access"].map(
                (item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-[#3ecf8e]" aria-hidden />
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* Catalog */}
        <section>
          <div className="mx-auto w-full max-w-6xl space-y-14 px-6 py-12 sm:px-8 sm:py-16">
            {/* Built in-house */}
            <div>
              <SectionHeading
                title="Built in-house"
                note="Runs in your dashboard"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {IN_HOUSE.map((product, i) => (
                  <li key={product.name}>
                    <InHouseCard product={product} index={i} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Accounts & access */}
            <div>
              <SectionHeading
                title="Accounts & access"
                note="Ordered via WhatsApp & marketplace"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MARKETPLACE_PRODUCTS.map((product, i) => (
                  <li key={product.name}>
                    <AccessCard product={product} index={i} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Router API unlimited plans */}
            <div>
              <SectionHeading
                title="Router API plans"
                note="Fair-use · no per-minute limit"
              />
              <Reveal delay={40}>
                <div className="card-sheen mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1c1c] p-6 sm:p-8">
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-md">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
                        <InfinityIcon className="h-3.5 w-3.5" aria-hidden />
                        Unlimited access
                      </span>
                      <h3 className="mt-4 text-xl font-semibold text-white">
                        yogathedev Router API
                      </h3>
                      <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                        Many AI models on one endpoint — Claude Opus 4.8 and
                        GPT-5.6 Sol among them. Pick a plan by how long you need
                        it; each carries a fair-use token allowance with no
                        per-minute rate limit.
                      </p>
                      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                        <Button size="sm" asChild>
                          <a
                            href={ROUTER_API_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Buy on Marketku
                            <ExternalLink aria-hidden />
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/console">
                            Check usage
                            <ArrowRight aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <div className="w-full lg:max-w-md">
                      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
                        <table className="w-full table-fixed text-left text-[13px] sm:text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.08] text-white/40">
                              <th className="px-4 py-3 font-medium sm:px-5">
                                Plan
                              </th>
                              <th className="px-4 py-3 font-medium sm:px-5">
                                Fair-use tokens
                              </th>
                              <th className="px-4 py-3 text-right font-medium sm:px-5">
                                Avg / day
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ROUTER_PLANS.map((plan) => (
                              <tr
                                key={plan.duration}
                                className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.02]"
                              >
                                <td className="px-4 py-3.5 font-medium text-white sm:px-5">
                                  <span className="flex items-center gap-2.5">
                                    <CalendarDays
                                      className="h-4 w-4 shrink-0 text-[#3ecf8e]"
                                      aria-hidden
                                    />
                                    {plan.duration}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-white/70 sm:px-5">
                                  {plan.tokens}
                                </td>
                                <td className="px-4 py-3.5 text-right font-mono text-white/55 sm:px-5">
                                  {plan.perDay}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-3 text-[12px] leading-relaxed text-white/35">
                        Fair-use caps on the unlimited plan; no per-minute rate
                        limit. Track consumption anytime on the{" "}
                        <Link
                          href="/console"
                          className="text-white/60 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
                        >
                          usage console
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>

            <p className="text-[13px] leading-relaxed text-white/40">
              AI Router and SMS Verification run in-house from the dashboard.
              API Model Frontier, ChatGPT Plus, and Kiro Pro open on Marketku in
              a new tab.
            </p>
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
