"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronUp,
  Copy,
  CreditCard,
  Key,
  Loader2,
  MessageSquare,
  Plus,
  RotateCw,
  Sparkles,
} from "lucide-react";
import hljs from "highlight.js/lib/common";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type {
  AiRoute,
  ChatConversationSummary,
  ChatMessage,
} from "./data";
import { AI_MODELS, AI_RECENT_CALLS } from "./data";

export { VpsView } from "./vps-view";

const CHAT_MODELS = [
  { slug: "gpt-5.5",          name: "GPT-5.5",          provider: "OpenAI" },
  { slug: "claude-opus-4.7",  name: "Claude Opus 4.7",  provider: "Anthropic" },
  { slug: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", provider: "Anthropic" },
] as const;

const HIGHLIGHT_CACHE = new Map<string, string>();

function highlightCode(code: string, lang: string | null): string {
  const key = `${lang ?? ""}::${code}`;
  const cached = HIGHLIGHT_CACHE.get(key);
  if (cached !== undefined) return cached;

  let html: string;
  try {
    if (lang && hljs.getLanguage(lang)) {
      html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } else {
      html = hljs.highlightAuto(code).value;
    }
  } catch {
    html = escapeHtml(code);
  }

  if (HIGHLIGHT_CACHE.size > 200) {
    const firstKey = HIGHLIGHT_CACHE.keys().next().value;
    if (firstKey !== undefined) HIGHLIGHT_CACHE.delete(firstKey);
  }
  HIGHLIGHT_CACHE.set(key, html);
  return html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
      description: "Top up your pay-as-you-go credit balance via QRIS.",
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

export function ChatView({
  conversation,
  defaultModel,
  onConversationUpdated,
}: {
  conversation: ChatConversationSummary;
  defaultModel?: string;
  onConversationUpdated?: (c: ChatConversationSummary) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(conversation.model || defaultModel || "");
  const [loaded, setLoaded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Hydrate messages whenever the active conversation changes.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);
    setMessages([]);
    setModel(conversation.model || defaultModel || "");

    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversation.id}`);
        if (!res.ok) {
          if (!cancelled) setError("Failed to load conversation.");
          return;
        }
        const data = (await res.json()) as {
          conversation: { id: string; title: string; model: string; updated_at: string };
          messages: ChatMessage[];
        };
        if (cancelled) return;
        setMessages(data.messages);
        setModel(data.conversation.model);
        setLoaded(true);
      } catch {
        if (!cancelled) setError("Failed to load conversation.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversation.id, conversation.model, defaultModel]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSelectModel = useCallback(
    async (slug: string) => {
      const previous = model;
      setModel(slug);
      try {
        const res = await fetch(`/api/conversations/${conversation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: slug }),
        });
        if (!res.ok) {
          setModel(previous);
          return;
        }
        const data = (await res.json()) as { conversation: ChatConversationSummary };
        onConversationUpdated?.(data.conversation);
      } catch {
        setModel(previous);
      }
    },
    [conversation.id, model, onConversationUpdated],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const assistantMsg: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    };
    const isFirstMessage = messages.length === 0;

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        },
      );

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let detail = text;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j?.error) detail = j.error;
        } catch {}
        throw new Error(detail || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep = buffer.indexOf("\n\n");
        while (sep !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          sep = buffer.indexOf("\n\n");

          const line = rawEvent.replace(/^data:\s*/, "");
          if (!line) continue;
          if (line === "[DONE]") continue;

          try {
            const parsed = JSON.parse(line) as {
              delta?: string;
              error?: string;
            };
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.delta) {
              setMessages((prev) => {
                const next = prev.slice();
                const last = next[next.length - 1];
                if (last && last.id === assistantMsg.id) {
                  next[next.length - 1] = {
                    ...last,
                    content: last.content + parsed.delta,
                  };
                }
                return next;
              });
            }
          } catch (err) {
            throw err instanceof Error
              ? err
              : new Error("Stream parse error");
          }
        }
      }

      onConversationUpdated?.({
        id: conversation.id,
        title: isFirstMessage
          ? deriveTitleClient(trimmed)
          : conversation.title,
        model,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      // Drop the empty assistant placeholder if nothing came back.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === assistantMsg.id && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [
    conversation.id,
    conversation.title,
    input,
    isStreaming,
    messages.length,
    model,
    onConversationUpdated,
  ]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-grow textarea up to ~200px.
  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 lg:max-w-3xl xl:max-w-4xl">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h2 className="truncate text-[15px] font-medium tracking-[-0.01em] text-white">
                {conversation.title}
              </h2>
              {model ? (
                <span className="shrink-0 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.07] px-2.5 py-0.5 font-mono text-[10px] text-[#3ecf8e]/70">
                  {model}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-white/30">
              {messages.length} messages · updated {formatRelative(conversation.updated_at)}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-6 sm:px-6 lg:max-w-3xl lg:px-8 xl:max-w-4xl">
          {!loaded && messages.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[12px] text-white/35">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading conversation…
            </div>
          ) : null}

          {loaded && messages.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-white/40">
              Send a message to start this conversation.
            </div>
          ) : null}

          {messages.map((m, i) => (
            <ChatBubble
              key={m.id}
              message={m}
              prevRole={i > 0 ? messages[i - 1].role : null}
              streaming={
                isStreaming &&
                i === messages.length - 1 &&
                m.role === "assistant"
              }
            />
          ))}

          {error ? (
            <div className="mt-4 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-200/85">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl">
          <div className="relative rounded-xl border border-white/[0.08] bg-[#171717] transition-colors focus-within:border-white/[0.16]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              disabled={isStreaming}
              placeholder="Message Chat AI…"
              className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-14 text-[14px] leading-relaxed text-white placeholder:text-white/25 focus:outline-none disabled:opacity-60"
              style={{ minHeight: "56px", maxHeight: "200px" }}
            />
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3">
              <ModelSelector model={model} onSelect={handleSelectModel} />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ecf8e] text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/30"
                aria-label="Send message"
              >
                {isStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                )}
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

function deriveTitleClient(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 50) return cleaned;
  const cut = cleaned.slice(0, 50);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + "…";
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function ChatEmptyState({
  onCreate,
  creating,
}: {
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6 sm:p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/50">
          <MessageSquare className="h-4 w-4" aria-hidden />
        </div>
        <h2 className="mt-4 text-[20px] font-medium tracking-[-0.01em] text-white">
          No conversations yet
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/55">
          Start your first chat. Your default model is configured in
          environment.
        </p>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden />
          )}
          New conversation
        </button>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  prevRole,
  streaming,
}: {
  message: ChatMessage;
  prevRole: ChatMessage["role"] | null;
  streaming?: boolean;
}) {
  const isUser = message.role === "user";
  const isFirstInGroup = prevRole !== message.role;

  if (isUser) {
    return (
      <div className={`flex justify-end ${isFirstInGroup ? "mt-5" : "mt-1"}`}>
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-[#3ecf8e]/12 bg-[#3ecf8e]/[0.07] px-4 py-3 text-[14px] leading-relaxed text-white/90">
          {message.content}
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
        <AssistantMarkdown content={message.content} />
        {streaming && message.content === "" ? (
          <span className="inline-flex items-center gap-1.5 text-white/35">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Thinking…
          </span>
        ) : null}
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
  const active = CHAT_MODELS.find((m) => m.slug === model) ?? CHAT_MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] tracking-tight transition-colors ${
          open
            ? "border-white/[0.14] bg-white/[0.05] text-white/80"
            : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/80"
        }`}
      >
        <Sparkles className="h-3 w-3 text-[#3ecf8e]/70" aria-hidden />
        <span className="max-w-[140px] truncate">{active.slug}</span>
        <ChevronUp
          className={`h-3 w-3 text-white/30 transition-transform group-hover:text-white/55 ${
            open ? "rotate-180" : ""
          }`}
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
          <div className="absolute bottom-full left-0 z-20 mb-2 w-[260px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1a1a] shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-black/30 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                Choose model
              </span>
              <span className="text-[10px] text-white/25">{CHAT_MODELS.length}</span>
            </div>
            <ul className="p-1.5">
              {CHAT_MODELS.map((m) => {
                const selected = model === m.slug;
                return (
                  <li key={m.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(m.slug);
                        setOpen(false);
                      }}
                      className={`group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                        selected
                          ? "bg-[#3ecf8e]/[0.08] text-white"
                          : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                          selected
                            ? "border-[#3ecf8e]/35 bg-[#3ecf8e]/[0.1] text-[#3ecf8e]"
                            : "border-white/[0.08] bg-white/[0.03] text-white/40 group-hover:border-white/[0.14] group-hover:text-white/60"
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="block truncate text-[13px] font-medium leading-tight">
                            {m.name}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-white/35">
                            {m.slug}
                          </span>
                          <span aria-hidden className="text-white/15">·</span>
                          <span className="text-[10px] text-white/40">
                            {m.provider}
                          </span>
                        </div>
                      </div>
                      {selected && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-[#3ecf8e]"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
            if (inline) {
              return (
                <code
                  className="mx-0.5 rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px] text-[#3ecf8e]/75"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            const match = /language-(\w+)/.exec(className || "");
            const lang = match?.[1] ?? null;
            const code = String(children).replace(/\n$/, "");
            return <CodeBubble lang={lang} code={code} />;
          },
          pre({ children }) {
            return <>{children}</>;
          },
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#3ecf8e] underline decoration-[#3ecf8e]/40 underline-offset-2 hover:decoration-[#3ecf8e]"
                {...props}
              >
                {children}
              </a>
            );
          },
          h1({ children }) {
            return <h1 className="mt-4 mb-2 text-[18px] font-medium text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mt-4 mb-2 text-[16px] font-medium text-white">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mt-3 mb-1.5 text-[14px] font-medium text-white">{children}</h3>;
          },
          p({ children }) {
            return <p className="my-2 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="my-2 ml-5 list-disc space-y-1 marker:text-white/30">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-white/30">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 border-l-2 border-white/15 pl-3 text-white/60">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-4 border-white/[0.06]" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-md border border-white/[0.08]">
                <table className="w-full border-collapse text-[13px]">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-white/[0.03]">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border-b border-white/[0.06] px-3 py-1.5 text-left font-medium text-white/70">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border-b border-white/[0.04] px-3 py-1.5">{children}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBubble({ lang, code }: { lang: string | null; code: string }) {
  const isSingleLine = !code.includes("\n") && code.trim().length <= 80;
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (isSingleLine) {
    return (
      <code className="mx-0.5 rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px] text-[#3ecf8e]/75">
        {code.trim()}
      </code>
    );
  }

  const html = highlightCode(code, lang);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-white/[0.07] bg-[#0f0f0f]">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
          {lang ?? "code"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 text-[10px] text-white/30 transition-colors hover:text-white/70"
        >
          {copied ? (
            <>
              <Check className="h-2.5 w-2.5" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-2.5 w-2.5" aria-hidden />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-white/85">
        <code
          className={`hljs${lang ? ` language-${lang}` : ""}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
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
