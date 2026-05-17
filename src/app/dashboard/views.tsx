"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUp,
  ChevronUp,
  Copy,
  CreditCard,
  Key,
  Plus,
  RotateCw,
  Sparkles,
} from "lucide-react";

import type {
  AiRoute,
  ChatConversation,
  ChatMessage,
} from "./data";
import { AI_MODELS, AI_RECENT_CALLS } from "./data";

export { VpsView } from "./vps-view";

/* -------------------------------------------------------------------------- */
/*  AI Overview (landing)                                                      */
/* -------------------------------------------------------------------------- */

export function AiOverview() {
  const cards = [
    {
      href: "/dashboard/ai/usage",
      icon: Activity,
      label: "Usage",
      description: "Monitor token consumption, request counts, and credit balance.",
    },
    {
      href: "/dashboard/ai/keys",
      icon: Key,
      label: "Keys",
      description: "Create and manage API keys for authenticating requests.",
    },
    {
      href: "/dashboard/ai/billing",
      icon: CreditCard,
      label: "Billing",
      description: "Top up your pay-as-you-go credit balance via bank transfer.",
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-xl">
        <h2 className="text-[18px] font-medium text-white">AI Router</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">
          OpenAI-compatible API endpoint — access top models with a single key, billed pay as you go.
        </p>

        <div className="mt-6 grid gap-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-center gap-4 rounded-lg border border-white/[0.08] bg-[#171717] p-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-white/50 group-hover:border-[#3ecf8e]/30 group-hover:text-[#3ecf8e] transition-colors">
                <card.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-white">{card.label}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">{card.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/20 group-hover:text-white/50 transition-colors" />
            </Link>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-white/[0.05] bg-white/[0.02] p-4 text-[12px] leading-relaxed text-white/35">
          <span className="font-mono text-white/55">POST</span>{" "}
          <span className="font-mono">https://api.dwipa.my.id/v1/chat/completions</span>
          <br />
          Compatible with any OpenAI SDK — just point to this base URL and use your API key.
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AI Router                                                                 */
/* -------------------------------------------------------------------------- */

export function AiRouterView({ route }: { route: AiRoute }) {
  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${
                route.active
                  ? "bg-[#3ecf8e] shadow-[0_0_10px_#3ecf8e]"
                  : "bg-white/30"
              }`}
            />
            <h2 className="font-mono text-[22px] font-medium tracking-[-0.01em] text-white">
              {route.name}
            </h2>
            <span className="rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#3ecf8e]">
              live
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px] text-white/55">
            <span className="font-mono">{route.path}</span>
            <span className="text-white/20">·</span>
            <span>
              <span className="text-white/70">{route.model}</span> ·{" "}
              <span className="text-white/40">fallback</span>{" "}
              <span className="text-white/70">{route.fallback}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Action icon={RotateCw} label="Replay last" />
          <Action icon={Activity} label="Test call" primary />
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="p50" value={route.p50} bar={0.4} />
        <MetricCard label="p95" value={route.p95} bar={0.75} />
        <MetricCard label="Errors" value={route.errors} bar={0.08} />
        <MetricCard
          label="Requests · 24h"
          value={route.requests24h.toLocaleString()}
          bar={0.6}
        />
      </div>

      {/* Recent calls */}
      <Panel title="Recent calls">
        <ul className="divide-y divide-white/[0.04] font-mono text-[12px]">
          {AI_RECENT_CALLS.map((c, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-2"
            >
              <span className="w-16 shrink-0 text-white/40">{c.ts}</span>
              <span className="shrink-0 rounded bg-[#3ecf8e]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[#3ecf8e]">
                {c.method}
              </span>
              <span className="min-w-0 flex-1 truncate text-white/80">{c.path}</span>
              <span className="hidden truncate text-white/50 md:inline">
                {c.model}
              </span>
              <span
                className={`w-12 shrink-0 text-right ${
                  c.status === 200
                    ? "text-white/60"
                    : c.status === 429
                      ? "text-yellow-300"
                      : "text-red-300"
                }`}
              >
                {c.status}
              </span>
              <span className="w-16 shrink-0 text-right text-white/40">{c.ms}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Config snippet */}
      <CodeBlock
        title="Request"
        lines={[
          `curl https://yoga.dev${route.path} \\`,
          `  -H "Authorization: Bearer $YOGA_KEY" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{`,
          `    "route": "${route.name}",`,
          `    "messages": [{"role":"user","content":"Hi"}]`,
          `  }'`,
        ]}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  bar,
}: {
  label: string;
  value: string;
  bar: number;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-4">
      <div className="text-[11px] uppercase tracking-[0.1em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-medium tracking-tight text-white">
        {value}
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[#3ecf8e]"
          style={{ width: `${Math.round(bar * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  primary,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  primary?: boolean;
}) {
  const base =
    "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors";
  const style = primary
    ? "bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e]"
    : "border border-white/[0.1] bg-white/[0.03] text-white/85 hover:border-white/20 hover:bg-white/[0.06]";
  return (
    <button type="button" className={`${base} ${style}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chat AI                                                                   */
/* -------------------------------------------------------------------------- */

export function ChatView({ conversation }: { conversation: ChatConversation }) {
  const [activeModel, setActiveModel] = useState(conversation.model);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-5 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="truncate text-[15px] font-medium tracking-[-0.01em] text-white">
              {conversation.title}
            </h2>
            <span className="shrink-0 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.07] px-2.5 py-0.5 font-mono text-[10px] text-[#3ecf8e]/70">
              {activeModel}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-white/30">
            {conversation.messages.length} messages · {conversation.updatedAt}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:border-[#3ecf8e]/25 hover:bg-[#3ecf8e]/[0.07] hover:text-[#3ecf8e]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New chat
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col px-5 py-6 sm:px-6">
          {conversation.messages.map((m, i) => (
            <ChatBubble
              key={m.id}
              message={m}
              prevRole={i > 0 ? conversation.messages[i - 1].role : null}
            />
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="relative rounded-xl border border-white/[0.08] bg-[#171717] transition-colors focus-within:border-white/[0.16]">
            <textarea
              rows={1}
              placeholder="Message Chat AI…"
              className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-14 text-[14px] leading-relaxed text-white placeholder:text-white/25 focus:outline-none"
              style={{ minHeight: "56px", maxHeight: "200px" }}
            />
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3">
              <ModelSelector model={activeModel} onSelect={setActiveModel} />
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ecf8e] text-[#171717] transition-colors hover:bg-[#24b47e]"
                aria-label="Send message"
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-white/20">
            <kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to send ·{" "}
            <kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[10px]">
              Shift+Enter
            </kbd>{" "}
            for new line
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  prevRole,
}: {
  message: ChatMessage;
  prevRole: "user" | "assistant" | null;
}) {
  const isUser = message.role === "user";
  const isFirstInGroup = prevRole !== message.role;
  const body = renderChatContent(message.content);

  if (isUser) {
    return (
      <div className={`flex justify-end ${isFirstInGroup ? "mt-5" : "mt-1"}`}>
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-[#3ecf8e]/12 bg-[#3ecf8e]/[0.07] px-4 py-3 text-[14px] leading-relaxed text-white/90">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2.5 ${isFirstInGroup ? "mt-5" : "mt-1"}`}>
      {isFirstInGroup ? (
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/40">
          <Sparkles className="h-3 w-3" aria-hidden />
        </span>
      ) : (
        <span className="inline-flex h-6 w-6 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-white/80">
        {body}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Model selector dropdown                                                   */
/* -------------------------------------------------------------------------- */

function ModelSelector({
  model,
  onSelect,
}: {
  model: string;
  onSelect: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = AI_MODELS.find((m) => m.slug === model) ?? AI_MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-[#1c1c1c] px-2.5 py-1 font-mono text-[10px] tracking-tight text-white/40 transition-colors hover:border-white/[0.12] hover:text-white/60"
      >
        <Sparkles className="h-2.5 w-2.5 text-[#3ecf8e]/60" aria-hidden />
        {active.slug}
        <ChevronUp
          className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-10"
            aria-label="Close model picker"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown panel — opens upward */}
          <div className="absolute bottom-full left-0 z-20 mb-2 w-60 overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="border-b border-white/[0.05] px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest text-white/30">
                Model
              </span>
            </div>
            <ul className="p-1">
              {AI_MODELS.map((m) => (
                <li key={m.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(m.slug);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/[0.05] ${
                      model === m.slug ? "text-white" : "text-white/55"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-[12px] font-medium leading-none">
                        {m.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-white/30">
                        {m.provider}
                      </span>
                    </div>
                    {model === m.slug && (
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3ecf8e]"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function renderChatContent(content: string) {
  // Fenced code blocks first, then inline code.
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const withoutFences = part.slice(3, -3);
      const langMatch = withoutFences.match(/^([a-zA-Z]+)\n/);
      const lang = langMatch?.[1] ?? null;
      const code = lang ? withoutFences.slice(lang.length + 1) : withoutFences;
      return (
        <div
          key={i}
          className="my-3 overflow-hidden rounded-lg border border-white/[0.07] bg-[#0f0f0f]"
        >
          {lang && (
            <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                {lang}
              </span>
              <button
                type="button"
                className="flex items-center gap-1 text-[10px] text-white/30 transition-colors hover:text-white/60"
              >
                <Copy className="h-2.5 w-2.5" aria-hidden />
                Copy
              </button>
            </div>
          )}
          <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-white/85">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    // Inline backtick code
    const inlineParts = part.split(/(`[^`\n]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((p, j) => {
          if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
            return (
              <code
                key={j}
                className="mx-0.5 rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px] text-[#3ecf8e]/75"
              >
                {p.slice(1, -1)}
              </code>
            );
          }
          return (
            <span key={j} className="whitespace-pre-wrap">
              {p}
            </span>
          );
        })}
      </span>
    );
  });
}

/* -------------------------------------------------------------------------- */
/*  Shared                                                                    */
/* -------------------------------------------------------------------------- */

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717]">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <span className="text-[11px] uppercase tracking-[0.1em] text-white/40">
          {title}
        </span>
      </header>
      {children}
    </section>
  );
}

function CodeBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f0f0f]">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <span className="text-[11px] uppercase tracking-[0.1em] text-white/40">
          {title}
        </span>
        <button
          type="button"
          className="text-[11px] text-white/40 transition-colors hover:text-white/80"
        >
          Copy
        </button>
      </header>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-white/90">
        <code>{lines.join("\n")}</code>
      </pre>
    </section>
  );
}

function LogRow({
  ts,
  text,
  tone,
}: {
  ts: string;
  text: string;
  tone?: "soft";
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <span className="w-16 shrink-0 text-white/40">{ts}</span>
      <span className={tone === "soft" ? "text-white/50" : "text-white/80"}>
        {text}
      </span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Placeholder — config / platform pages we haven't built yet                */
/* -------------------------------------------------------------------------- */

export function PlaceholderView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6 sm:p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/50">
          <Plus className="h-4 w-4" aria-hidden />
        </div>
        <h2 className="mt-4 text-[20px] font-medium tracking-[-0.01em] text-white">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/55">
          {description}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-white/50">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]"
          />
          Coming soon
        </span>
      </div>
    </div>
  );
}
