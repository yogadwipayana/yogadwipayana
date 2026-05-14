"use client";

import {
  Activity,
  ArrowUp,
  Bot,
  Cpu,
  Globe,
  HardDrive,
  MemoryStick,
  Play,
  Plus,
  RotateCw,
  Square,
  TerminalSquare,
  User,
} from "lucide-react";

import type {
  AiRoute,
  ChatConversation,
  ChatMessage,
  VpsInstance,
  VpsStatus,
} from "./data";
import { AI_RECENT_CALLS } from "./data";

/* -------------------------------------------------------------------------- */
/*  VPS                                                                       */
/* -------------------------------------------------------------------------- */

export function VpsView({ instance }: { instance: VpsInstance }) {
  const metrics = [
    { label: "CPU", value: `${instance.cpu}%`, pct: instance.cpu, icon: Cpu, sub: `${instance.vcpu} vCPU` },
    { label: "Memory", value: `${instance.memory}%`, pct: instance.memory, icon: MemoryStick, sub: `${instance.memoryGb} GB` },
    { label: "Disk", value: `${instance.disk}%`, pct: instance.disk, icon: HardDrive, sub: `${instance.diskGb} GB SSD` },
    { label: "Network", value: "48 Mb/s", pct: 32, icon: Activity, sub: "in/out" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <StatusDot status={instance.status} />
            <h2 className="font-mono text-[22px] font-medium tracking-[-0.01em] text-white">
              {instance.name}
            </h2>
            <StatusBadge status={instance.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px] text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" aria-hidden />
              {instance.region}
            </span>
            <span className="text-white/20">·</span>
            <span className="font-mono">{instance.ipv4}</span>
            <span className="text-white/20">·</span>
            <span>uptime {instance.uptime}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {instance.status === "running" ? (
            <Action icon={Square} label="Stop" />
          ) : (
            <Action icon={Play} label="Start" primary />
          )}
          <Action icon={RotateCw} label="Reboot" />
          <Action icon={TerminalSquare} label="SSH" />
        </div>
      </header>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, pct, icon: Icon, sub }) => (
          <div
            key={label}
            className="rounded-lg border border-white/[0.08] bg-[#171717] p-4"
          >
            <div className="flex items-center justify-between text-white/40">
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em]">
                <Icon className="h-3 w-3" aria-hidden />
                {label}
              </span>
              <span className="font-mono text-[10px]">{sub}</span>
            </div>
            <div className="mt-2 text-[22px] font-medium tracking-tight text-white">
              {value}
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#3ecf8e]"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* SSH + log */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
        <CodeBlock
          title="SSH"
          lines={[
            `$ ssh root@${instance.ipv4}`,
            "Welcome to Ubuntu 24.04 LTS",
            "Last login: Tue May 13 09:32:11 +08 2026",
          ]}
        />
        <Panel title="Recent activity">
          <ul className="divide-y divide-white/[0.04] font-mono text-[12px]">
            <LogRow ts="09:32:11" text="SSH login from 103.157.xx.xx" />
            <LogRow ts="09:15:02" text="systemd: bot-runner.service restarted" />
            <LogRow ts="08:44:57" text="apt: 3 packages upgraded" tone="soft" />
            <LogRow ts="04:12:00" text="cron: snapshot created" tone="soft" />
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: VpsStatus }) {
  const cls =
    status === "running"
      ? "bg-[#3ecf8e] shadow-[0_0_10px_#3ecf8e]"
      : status === "rebooting"
        ? "bg-yellow-400"
        : "bg-white/30";
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function StatusBadge({ status }: { status: VpsStatus }) {
  const cls =
    status === "running"
      ? "border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]"
      : status === "rebooting"
        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
        : "border-white/[0.08] bg-white/[0.04] text-white/50";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${cls}`}
    >
      {status}
    </span>
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

/* -------------------------------------------------------------------------- */
/*  Chat AI                                                                   */
/* -------------------------------------------------------------------------- */

export function ChatView({ conversation }: { conversation: ChatConversation }) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4 sm:px-8">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-medium tracking-[-0.01em] text-white">
            {conversation.title}
          </h2>
          <div className="mt-0.5 flex items-center gap-3 text-[12px] text-white/45">
            <span className="font-mono">{conversation.model}</span>
            <span className="text-white/20">·</span>
            <span>{conversation.updatedAt}</span>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/70 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        <ul className="mx-auto flex max-w-3xl flex-col gap-5">
          {conversation.messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
        </ul>
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] bg-[#171717] px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-lg border border-white/[0.08] bg-[#1c1c1c] p-2 focus-within:border-[#3ecf8e]/40">
          <textarea
            rows={1}
            placeholder="Reply…"
            className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e]"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const body = renderChatContent(message.content);

  return (
    <li className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
          isUser
            ? "border-[#3ecf8e]/30 bg-[#3ecf8e]/15 text-[#3ecf8e]"
            : "border-white/10 bg-white/[0.04] text-white/70"
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Bot className="h-3.5 w-3.5" aria-hidden />
        )}
      </span>
      <div
        className={`max-w-[85%] rounded-lg border px-4 py-3 text-[14px] leading-relaxed ${
          isUser
            ? "border-[#3ecf8e]/20 bg-[#3ecf8e]/5 text-white"
            : "border-white/[0.08] bg-[#171717] text-white/85"
        }`}
      >
        {body}
      </div>
    </li>
  );
}

function renderChatContent(content: string) {
  // Extremely tiny markdown: fenced code blocks only. Everything else is plain text.
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const body = part.slice(3, -3).replace(/^[a-zA-Z]+\n/, "");
      return (
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-md border border-white/[0.06] bg-[#0f0f0f] p-3 font-mono text-[12px] text-white/90"
        >
          <code>{body}</code>
        </pre>
      );
    }
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part}
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
