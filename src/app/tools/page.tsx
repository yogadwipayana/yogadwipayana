import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Cpu,
  MessageSquare,
  Server,
  Waypoints,
} from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Tools",
  description:
    "A small catalogue of developer tools I run: VPS Control, AI Router, and Chat AI. Try them in public or run them together inside the dashboard.",
};

type Tool = {
  id: string;
  index: string;
  name: string;
  tag: string;
  tagline: string;
  blurb: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  features: string[];
  mock: React.ReactNode;
};

const TOOLS: Tool[] = [
  {
    id: "vps",
    index: "01",
    name: "VPS Control",
    tag: "Infrastructure",
    tagline: "A single console for every machine I run.",
    blurb:
      "Order, monitor, and tear down instances from one place. Live CPU, memory, disk, and bandwidth per box, firewall and SSH keys in the same surface, and reinstall or reset without leaving the page.",
    href: "/vps",
    icon: Server,
    features: [
      "Status, CPU, memory, disk, uptime per instance",
      "Firewall rules and SSH keys per box",
      "Reinstall OS or full reset in two clicks",
      "Order new instances and manage payment",
      "Bring-your-own-key for existing providers",
    ],
    mock: <VpsMock />,
  },
  {
    id: "ai",
    index: "02",
    name: "AI Router",
    tag: "Models",
    tagline: "One key. Every model. Real metrics.",
    blurb:
      "Route prompts across providers behind a single API key. Configure per-route models with fallbacks, watch p50/p95/error rates live, and track credit, requests, and tokens against a model catalog with real pricing.",
    href: "/ai",
    icon: Waypoints,
    features: [
      "Per-route model selection with fallback",
      "p50 / p95 / error rate per route",
      "API keys with masked values and last-used",
      "Credit balance, requests, tokens today",
      "Model catalog with context window and pricing",
    ],
    mock: <RouterMock />,
  },
  {
    id: "chat",
    index: "03",
    name: "Chat AI",
    tag: "Assistants",
    tagline: "A quieter place to think with a model.",
    blurb:
      "A focused conversational workspace backed by the AI Router. Pick the model per conversation, keep history across sessions, and read code answers rendered the way they should be — no tab switching, no copy-paste theatre.",
    href: "/chat",
    icon: MessageSquare,
    features: [
      "Persistent conversation history",
      "Per-conversation model picker via AI Router",
      "Markdown and code rendering inline",
      "Threaded sidebar with snippets and timestamps",
    ],
    mock: <ChatMock />,
  },
];

export default function ToolsPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <Navbar />

      <main className="flex-1">
        <Hero />
        <ToolsList />
        <DashboardCta />
      </main>

      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.08]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-0 h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-[#3ecf8e]/10 blur-[120px]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-16 sm:px-8 sm:pt-24 sm:pb-20">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/80">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]"
            />
            Catalogue · {TOOLS.length} tools
          </span>

          <h1 className="max-w-4xl text-[40px] font-medium leading-[1.05] tracking-[-0.035em] sm:text-[56px] md:text-[64px]">
            Tools I run here.
            <br />
            <span className="text-white/50">Small, focused, for me first.</span>
          </h1>

          <p className="max-w-2xl text-[17px] leading-[1.65] text-white/65">
            A short catalogue of the utilities I use daily. Try each one in
            public, or sign in and run them together inside the dashboard.
          </p>

          <nav aria-label="Jump to tool" className="mt-2 flex flex-wrap gap-2">
            {TOOLS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              >
                <span className="font-mono text-[10px] text-white/40">
                  {t.index}
                </span>
                {t.name}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tools list                                                                */
/* -------------------------------------------------------------------------- */

function ToolsList() {
  return (
    <section className="divide-y divide-white/[0.08]">
      {TOOLS.map((tool, i) => (
        <ToolRow key={tool.id} tool={tool} reversed={i % 2 === 1} />
      ))}
    </section>
  );
}

function ToolRow({ tool, reversed }: { tool: Tool; reversed?: boolean }) {
  const Icon = tool.icon;

  return (
    <article
      id={tool.id}
      className={`${reversed ? "bg-[#171717]" : "bg-[#1c1c1c]"} scroll-mt-20`}
    >
      <div
        className={`mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-20 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16 ${
          reversed ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/80">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-mono text-[12px] text-white/40">
              {tool.index}
            </span>
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/60">
              {tool.tag}
            </span>
          </div>

          <div>
            <h2 className="text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
              {tool.name}
            </h2>
            <p className="mt-2 text-base text-[#3ecf8e]/90">{tool.tagline}</p>
          </div>

          <p className="max-w-xl text-[15px] leading-[1.65] text-white/65">
            {tool.blurb}
          </p>

          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {tool.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-[14px] leading-relaxed text-white/75"
              >
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#3ecf8e]"
                  aria-hidden
                />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link
              href={tool.href}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              Try {tool.name}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={`/dashboard/${tool.id}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.04]"
            >
              Open in dashboard
            </Link>
          </div>
        </div>

        <div className="w-full">{tool.mock}</div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                     */
/* -------------------------------------------------------------------------- */

function MockShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-3 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/50">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function VpsMock() {
  const instances = [
    {
      name: "edge-sg-1",
      region: "Singapore · SG1",
      ipv4: "139.162.42.18",
      cpu: 18,
      mem: 42,
      status: "running",
    },
    {
      name: "worker-de-2",
      region: "Frankfurt · FRA1",
      ipv4: "139.162.55.102",
      cpu: 67,
      mem: 71,
      status: "running",
    },
    {
      name: "dev-sandbox",
      region: "Jakarta · ID1",
      ipv4: "—",
      cpu: 0,
      mem: 0,
      status: "stopped",
    },
  ];

  return (
    <MockShell title="dashboard/vps">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13px] font-medium text-white">Instances</div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/50">
            <Cpu className="h-3 w-3" aria-hidden />3 total
          </span>
        </div>
        <ul className="overflow-hidden rounded-md border border-white/[0.06] bg-[#1c1c1c]">
          {instances.map((i, idx) => (
            <li
              key={i.name}
              className={`flex flex-col gap-1.5 px-3 py-2.5 text-[12px] ${
                idx !== instances.length - 1
                  ? "border-b border-white/[0.05]"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      i.status === "running" ? "bg-[#3ecf8e]" : "bg-white/30"
                    }`}
                  />
                  <span className="truncate font-mono text-white/80">
                    {i.name}
                  </span>
                  <span className="hidden text-white/40 sm:inline">·</span>
                  <span className="hidden truncate text-white/50 sm:inline">
                    {i.region}
                  </span>
                </span>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-white/40">
                  {i.ipv4}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-white/40">
                <span className="flex items-center gap-1.5">
                  <span>cpu {i.cpu}%</span>
                  <span className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className={`block h-full rounded-full ${
                        i.status === "running" ? "bg-[#3ecf8e]" : "bg-white/30"
                      }`}
                      style={{ width: `${i.cpu}%` }}
                    />
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span>mem {i.mem}%</span>
                  <span className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className={`block h-full rounded-full ${
                        i.status === "running" ? "bg-[#3ecf8e]" : "bg-white/30"
                      }`}
                      style={{ width: `${i.mem}%` }}
                    />
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Firewall", "SSH keys", "Reinstall", "BYOK"].map((t) => (
            <span
              key={t}
              className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-white/60"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </MockShell>
  );
}

function RouterMock() {
  const routes = [
    {
      name: "default",
      model: "claude-opus-4",
      fallback: "gpt-5",
      p50: "124ms",
    },
    {
      name: "fast",
      model: "gpt-4o-mini",
      fallback: "claude-haiku",
      p50: "89ms",
    },
    {
      name: "embed",
      model: "voyage-3",
      fallback: "—",
      p50: "32ms",
    },
  ];

  return (
    <MockShell title="dashboard/ai">
      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          <RouterMetric label="credit" value="$1.84" bar={0.18} />
          <RouterMetric label="requests" value="1,204" bar={0.6} />
          <RouterMetric label="tokens" value="124.5k" bar={0.45} />
        </div>
        <div className="rounded-md border border-white/[0.06] bg-[#1c1c1c]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-white/40">
            <span>Routes</span>
            <span className="font-mono text-[10px] normal-case tracking-normal text-white/30">
              p50
            </span>
          </div>
          <ul className="divide-y divide-white/[0.04] font-mono text-[11px]">
            {routes.map((r) => (
              <li
                key={r.name}
                className="flex items-center justify-between px-3 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2 text-white/70">
                  <span className="rounded bg-[#3ecf8e]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[#3ecf8e]">
                    {r.name}
                  </span>
                  <span className="truncate text-white/80">{r.model}</span>
                  <span className="hidden text-white/30 sm:inline">→</span>
                  <span className="hidden truncate text-white/40 sm:inline">
                    {r.fallback}
                  </span>
                </span>
                <span className="ml-2 shrink-0 text-white/40">{r.p50}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MockShell>
  );
}

function RouterMetric({
  label,
  value,
  bar,
}: {
  label: string;
  value: string;
  bar: number;
}) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-[#1c1c1c] p-2.5">
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/40">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-medium text-white">{value}</div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[#3ecf8e]"
          style={{ width: `${Math.round(bar * 100)}%` }}
        />
      </div>
    </div>
  );
}

function ChatMock() {
  return (
    <MockShell title="dashboard/chat">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-white/70">
            <CircleDot className="h-3 w-3 text-[#3ecf8e]" aria-hidden />
            New conversation
          </div>
          <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/50">
            claude-opus-4
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Bubble role="user">How do I debounce a react effect?</Bubble>
          <Bubble role="assistant">
            Usually you don&rsquo;t debounce the effect itself — you debounce
            the value that feeds it. Derive a debounced version of your input
            and only let the effect run when the debounced value changes.
          </Bubble>
          <Bubble role="user">Show me the minimal version.</Bubble>
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#3ecf8e]/10 px-2.5 py-1 font-mono text-[11px] text-[#3ecf8e]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#3ecf8e]" />
            typing…
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 text-[12px] text-white/40">
          <span className="text-white/40">›</span>
          <span className="flex-1 truncate font-mono">Reply…</span>
          <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/50">
            ↵
          </span>
        </div>
      </div>
    </MockShell>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div
      className={`max-w-[85%] rounded-md border px-3 py-2 text-[12px] leading-relaxed ${
        isUser
          ? "self-end border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-white"
          : "self-start border-white/[0.08] bg-[#1c1c1c] text-white/80"
      }`}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard CTA                                                             */
/* -------------------------------------------------------------------------- */

function DashboardCta() {
  return (
    <section className="border-t border-white/[0.08]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171717] p-10 sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#3ecf8e]/15 blur-3xl"
          />

          <div className="relative grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
            <div>
              <span className="text-xs uppercase tracking-[0.12em] text-[#3ecf8e]">
                Run them together
              </span>
              <h2 className="mt-3 text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
                One sidebar, every tool.
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-white/65">
                The dashboard keeps a collapsed primary sidebar with every
                tool, a sub-sidebar that switches context with the tool you
                pick, and a working surface that gets out of the way.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
              >
                Open dashboard
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/about"
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.04]"
              >
                What is this site?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
