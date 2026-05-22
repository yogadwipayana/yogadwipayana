"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Globe,
  ImagePlus,
  Key,
  Link2,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Server,
  Share2,
  Square,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import hljs from "highlight.js/lib/common";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type {
  AiRoute,
  ChatConversationSummary,
  ChatMessage,
  ChatMode,
  ToolEvent,
} from "./data";
import { AI_MODELS, AI_RECENT_CALLS, CHAT_MODES } from "./data";
import { deriveConversationTitle } from "@/lib/chat-title";
import { copyToClipboard } from "@/lib/utils";

export { VpsView } from "./vps-view";

/**
 * Models the chat dropdown shows. Sourced from the same catalogue as the
 * `/dashboard/ai/models` page so the two cannot drift. If the conversation's
 * stored model isn't in this list, `ModelSelector` shows the raw slug with a
 * "custom" hint instead of silently snapping to the first option.
 */
const CHAT_MODELS = AI_MODELS.map((m) => ({
  slug: m.slug,
  name: m.name,
  provider: m.provider,
}));

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

/* -------------------------------------------------------------------------- */
/*  Attachment types                                                           */
/* -------------------------------------------------------------------------- */

type AttachmentKind = "image" | "pdf";

type Attachment = {
  key: string; // unique local key
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  publicUrl: string;
  uploading: boolean;
  error?: string;
};

/* -------------------------------------------------------------------------- */
/*  Slash command definitions                                                  */
/* -------------------------------------------------------------------------- */

const SLASH_COMMANDS = [
  { command: "/summarize", description: "Summarize the conversation or pasted text." },
  { command: "/translate", description: "/translate <lang> <text> — Translate to another language." },
  { command: "/explain", description: "Walk through a piece of text or code." },
  { command: "/diagram", description: "Generate a Mermaid diagram." },
] as const;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

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
  const [mode, setMode] = useState<ChatMode>(conversation.mode ?? "chat");
  const [loaded, setLoaded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Tracks whether the user is "pinned" to the bottom. We only auto-scroll on
  // new tokens when this is true, so reading earlier messages mid-stream isn't
  // disrupted by every delta.
  const pinnedToBottomRef = useRef(true);

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Slash command autocomplete
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  // Share dropdown
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareConv, setShareConv] = useState<ChatConversationSummary>(conversation);
  const [shareCopied, setShareCopied] = useState(false);

  // Keep shareConv in sync when conversation prop changes (e.g. after sidebar update)
  useEffect(() => {
    setShareConv(conversation);
  }, [conversation]);

  // Hydrate messages once per mount. The parent shell remounts this view on
  // conversation change via `key={conversation.id}`, so we don't need to reset
  // local state inside the effect.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversation.id}`);
        if (!res.ok) {
          if (!cancelled) setError("Failed to load conversation.");
          return;
        }
        const data = (await res.json()) as {
          conversation: {
            id: string;
            title: string;
            model: string;
            mode: ChatMode;
            updated_at: string;
          };
          messages: ChatMessage[];
        };
        if (cancelled) return;
        setMessages(data.messages);
        setModel(data.conversation.model);
        setMode(data.conversation.mode ?? "chat");
        setLoaded(true);
      } catch {
        if (!cancelled) setError("Failed to load conversation.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversation.id]);

  // Track whether the user is at the bottom of the scroll container so we know
  // whether to auto-scroll on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      pinnedToBottomRef.current = distanceFromBottom < 64;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll only when the user was already pinned to the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Cancel any in-flight stream when the view unmounts (conversation switch).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSelectModel = useCallback(
    async (slug: string) => {
      // Capture state at dispatch time so a later, faster response can't
      // clobber a slower-but-newer selection.
      const previous = model;
      setModel(slug);
      try {
        const res = await fetch(`/api/conversations/${conversation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: slug }),
        });
        if (!res.ok) {
          // Only revert if the user hasn't picked a different model since.
          setModel((current) => (current === slug ? previous : current));
          return;
        }
        const data = (await res.json()) as { conversation: ChatConversationSummary };
        // Likewise, ignore stale success: another selection may already be in
        // flight and we don't want to surface this conversation summary in the
        // sidebar with the wrong model.
        setModel((current) => {
          if (current !== slug) return current;
          onConversationUpdated?.(data.conversation);
          return current;
        });
      } catch {
        setModel((current) => (current === slug ? previous : current));
      }
    },
    [conversation.id, model, onConversationUpdated],
  );

  const handleSelectMode = useCallback(
    async (slug: ChatMode) => {
      const previous = mode;
      setMode(slug);
      try {
        const res = await fetch(`/api/conversations/${conversation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: slug }),
        });
        if (!res.ok) {
          setMode((current) => (current === slug ? previous : current));
          return;
        }
        const data = (await res.json()) as { conversation: ChatConversationSummary };
        setMode((current) => {
          if (current !== slug) return current;
          onConversationUpdated?.(data.conversation);
          return current;
        });
      } catch {
        setMode((current) => (current === slug ? previous : current));
      }
    },
    [conversation.id, mode, onConversationUpdated],
  );

  // Shared streaming consumer for both initial sends and regenerate. Mutates
  // the assistant placeholder message in place.
  const consumeStream = useCallback(
    async (
      res: Response,
      assistantMsgId: string,
      opts?: { localUserId?: string },
    ) => {
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
      // Track current assistant msg id (may be updated by `saved` events)
      let currentAssistantId = assistantMsgId;

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
          if (!line || line === "[DONE]") continue;

          const parsed = JSON.parse(line) as {
            delta?: string;
            error?: string;
            saved?: { role: "user" | "assistant"; id: string };
            tool?: {
              name: string;
              status: "running" | "done";
              call_id: string;
              args?: unknown;
              result?: unknown;
            };
          };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.saved) {
            const saved = parsed.saved;
            // Reconcile local IDs with persisted DB IDs so user-message edits
            // and other id-bound actions hit the right row.
            setMessages((prev) =>
              prev.map((m) => {
                if (saved.role === "user" && opts?.localUserId === m.id) {
                  return { ...m, id: saved.id };
                }
                if (saved.role === "assistant" && m.id === currentAssistantId) {
                  return { ...m, id: saved.id };
                }
                return m;
              }),
            );
            // Keep the placeholder id in sync for subsequent delta events that
            // still target the original local id.
            if (saved.role === "assistant") {
              currentAssistantId = saved.id;
            }
            continue;
          }
          if (parsed.tool) {
            const toolEvt = parsed.tool;
            setMessages((prev) => {
              const next = prev.slice();
              const last = next[next.length - 1];
              if (last && last.id === currentAssistantId) {
                const existing = last.toolEvents ?? [];
                const idx = existing.findIndex((e) => e.call_id === toolEvt.call_id);
                const updated: ToolEvent = {
                  call_id: toolEvt.call_id,
                  name: toolEvt.name,
                  status: toolEvt.status,
                  args: toolEvt.args,
                  result: toolEvt.result,
                };
                const newEvents =
                  idx === -1
                    ? [...existing, updated]
                    : existing.map((e, i) => (i === idx ? updated : e));
                next[next.length - 1] = { ...last, toolEvents: newEvents };
              }
              return next;
            });
            continue;
          }
          if (parsed.delta) {
            setMessages((prev) => {
              const next = prev.slice();
              const last = next[next.length - 1];
              if (last && last.id === currentAssistantId) {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + parsed.delta,
                };
              }
              return next;
            });
          }
        }
      }
    },
    [],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    // Block send while any attachment is still uploading
    if (attachments.some((a) => a.uploading)) return;

    const readyAttachments = attachments.filter((a) => !a.error);

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

    // New send always pins to bottom — the user is engaged with the latest turn.
    pinnedToBottomRef.current = true;
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setAttachments([]);
    setSlashOpen(false);
    setIsStreaming(true);
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const body: { content: string; attachments?: { kind: AttachmentKind; url: string; name: string; mime: string; size: number }[] } = {
        content: trimmed,
      };
      if (readyAttachments.length > 0) {
        body.attachments = readyAttachments.map((a) => ({
          kind: a.kind,
          url: a.publicUrl,
          name: a.name,
          mime: a.mime,
          size: a.size,
        }));
      }

      const res = await fetch(
        `/api/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        },
      );

      await consumeStream(res, assistantMsg.id, { localUserId: userMsg.id });

      onConversationUpdated?.({
        id: conversation.id,
        title: isFirstMessage
          ? deriveConversationTitle(trimmed)
          : conversation.title,
        model,
        mode,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped the stream — keep whatever streamed in. Server-side the
        // partial reply is persisted by the route's stream-error handler when
        // the connection drops, so there's nothing to clean up here.
        return;
      }
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
      if (abortRef.current === ctrl) abortRef.current = null;
      setIsStreaming(false);
    }
  }, [
    attachments,
    consumeStream,
    conversation.id,
    conversation.title,
    input,
    isStreaming,
    messages.length,
    model,
    mode,
    onConversationUpdated,
  ]);

  const handleRegenerate = useCallback(async () => {
    if (isStreaming) return;
    if (messages.length === 0) return;

    // Drop trailing assistant message in the UI (mirroring server behavior)
    // and replace it with a streaming placeholder.
    const next = messages.slice();
    if (next[next.length - 1]?.role === "assistant") next.pop();
    if (next.length === 0) return;

    const assistantMsg: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    };

    pinnedToBottomRef.current = true;
    setMessages([...next, assistantMsg]);
    setIsStreaming(true);
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(
        `/api/conversations/${conversation.id}/messages/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
        },
      );
      await consumeStream(res, assistantMsg.id);
      onConversationUpdated?.({
        id: conversation.id,
        title: conversation.title,
        model,
        mode,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === assistantMsg.id && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setIsStreaming(false);
    }
  }, [
    consumeStream,
    conversation.id,
    conversation.title,
    isStreaming,
    messages,
    model,
    mode,
    onConversationUpdated,
  ]);

  const handleRename = useCallback(
    async (nextTitle: string) => {
      const trimmed = nextTitle.trim();
      if (!trimmed || trimmed === conversation.title) return;
      try {
        const res = await fetch(`/api/conversations/${conversation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { conversation: ChatConversationSummary };
        onConversationUpdated?.(data.conversation);
      } catch {}
    },
    [conversation.id, conversation.title, onConversationUpdated],
  );

  const handleEditUser = useCallback(
    async (messageId: string, nextContent: string) => {
      if (isStreaming) return;
      const trimmed = nextContent.trim();
      if (!trimmed) return;

      // Locally truncate the conversation at the edited message and append a
      // fresh assistant placeholder. The server will persist the same shape
      // when the request resolves.
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;

      const original = messages[idx];
      if (original.role !== "user") return;
      if (trimmed === original.content) return;

      const editedUser: ChatMessage = { ...original, content: trimmed };
      const assistantMsg: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
      };

      const truncated = messages.slice(0, idx);
      pinnedToBottomRef.current = true;
      setMessages([...truncated, editedUser, assistantMsg]);
      setIsStreaming(true);
      setError(null);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(
          `/api/conversations/${conversation.id}/messages/edit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, content: trimmed }),
            signal: ctrl.signal,
          },
        );
        await consumeStream(res, assistantMsg.id);
        onConversationUpdated?.({
          id: conversation.id,
          title: conversation.title,
          model,
          mode,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantMsg.id && last.content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [
      consumeStream,
      conversation.id,
      conversation.title,
      isStreaming,
      messages,
      model,
      mode,
      onConversationUpdated,
    ],
  );

  // Upload a single file: POST /api/upload → presigned URL → PUT to S3
  const uploadFile = useCallback(async (file: File) => {
    if (!ACCEPTED_MIME.includes(file.type)) return;
    if (file.size > MAX_ATTACHMENT_BYTES) return;
    if (attachments.length >= MAX_ATTACHMENTS) return;

    const key = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const kind: AttachmentKind = file.type === "application/pdf" ? "pdf" : "image";

    const placeholder: Attachment = {
      key,
      kind,
      name: file.name,
      mime: file.type,
      size: file.size,
      publicUrl: "",
      uploading: true,
    };
    setAttachments((prev) => [...prev, placeholder]);

    try {
      const metaRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      if (!metaRes.ok) throw new Error(`Upload init failed: ${metaRes.status}`);
      const meta = (await metaRes.json()) as { url: string; method: string; key: string; publicUrl: string };

      await fetch(meta.url, {
        method: meta.method ?? "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setAttachments((prev) =>
        prev.map((a) =>
          a.key === key ? { ...a, uploading: false, publicUrl: meta.publicUrl } : a,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setAttachments((prev) =>
        prev.map((a) => (a.key === key ? { ...a, uploading: false, error: msg } : a)),
      );
    }
  }, [attachments.length]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = MAX_ATTACHMENTS - attachments.length;
      arr.slice(0, remaining).forEach((f) => void uploadFile(f));
    },
    [attachments.length, uploadFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;
      const imageItems: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) imageItems.push(f);
        }
      }
      if (imageItems.length > 0) {
        e.preventDefault();
        handleFiles(imageItems);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  // Slash command: detect when input matches ^\s*\/\w*$
  const checkSlash = useCallback((val: string) => {
    const match = /^\s*\/(\w*)$/.exec(val);
    if (match) {
      const filter = match[1].toLowerCase();
      setSlashFilter(filter);
      setSlashIndex(0);
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
  }, []);

  const filteredCommands = useMemo(
    () =>
      SLASH_COMMANDS.filter((c) =>
        c.command.slice(1).startsWith(slashFilter),
      ),
    [slashFilter],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filteredCommands[slashIndex];
        if (cmd) {
          const newVal = cmd.command + " ";
          setInput(newVal);
          setSlashOpen(false);
          const el = textareaRef.current;
          if (el) {
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            // Move cursor to end
            requestAnimationFrame(() => {
              el.setSelectionRange(newVal.length, newVal.length);
              el.focus();
            });
          }
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-grow textarea up to ~200px.
  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    checkSlash(val);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  };

  // Share handlers
  const handleToggleShare = useCallback(async () => {
    const nextPublic = !shareConv.is_public;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make_public: nextPublic }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversation: ChatConversationSummary;
        share_url: string | null;
      };
      setShareConv(data.conversation);
      onConversationUpdated?.(data.conversation);
    } catch {
      // silently ignore
    } finally {
      setShareLoading(false);
    }
  }, [conversation.id, shareConv.is_public, onConversationUpdated]);

  const handleExport = useCallback(() => {
    window.open(`/api/conversations/${conversation.id}/export`, "_blank");
  }, [conversation.id]);

  // Iterate-on-image: pre-fill the prompt and attach the original image as a
  // reference. The model's `image_edit` tool picks up the attachment URL when
  // the message is sent. Switches the conversation to image mode if it isn't
  // already, so the IMAGE_MODE_SYSTEM_PROMPT applies.
  const handleIterateImage = useCallback(
    (imageUrl: string) => {
      // Resolve relative /generated-images/ paths to absolute so the model can
      // fetch them — chat-tools rejects non-http(s) URLs.
      let absoluteUrl = imageUrl;
      if (imageUrl.startsWith("/")) {
        if (typeof window !== "undefined") {
          absoluteUrl = `${window.location.origin}${imageUrl}`;
        }
      }

      const filename = imageUrl.split("/").pop() || "image.png";
      const att: Attachment = {
        key: `iterate-${Date.now()}`,
        kind: "image",
        name: filename,
        mime: "image/png",
        size: 0,
        publicUrl: absoluteUrl,
        uploading: false,
      };
      setAttachments((prev) =>
        prev.length >= MAX_ATTACHMENTS ? prev : [...prev, att],
      );
      setInput("Iterate on this image: ");
      if (mode !== "image") {
        void handleSelectMode("image");
      }
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    },
    [handleSelectMode, mode],
  );

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  const anyUploading = attachments.some((a) => a.uploading);
  const canSend = !!input.trim() && !isStreaming && !anyUploading;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 lg:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <EditableTitle
                title={conversation.title}
                onSave={handleRename}
              />
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
          {/* Share + Export buttons */}
          <div className="relative flex shrink-0 items-center gap-1">
            {/* Export */}
            <button
              type="button"
              onClick={handleExport}
              title="Export as Markdown"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-white/40 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/70 sm:h-7 sm:w-7"
            >
              <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
            </button>
            {/* Share */}
            <button
              type="button"
              onClick={() => setShareOpen((v) => !v)}
              title="Share conversation"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors sm:h-7 sm:w-7 ${
                shareOpen
                  ? "border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.08] text-[#3ecf8e]/80"
                  : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/70"
              }`}
            >
              <Share2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
            </button>
            {shareOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close share panel"
                  onClick={() => setShareOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-2 w-[calc(100vw-2rem)] max-w-[280px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1a1a] shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-black/30">
                  <div className="border-b border-white/[0.06] px-3 py-2.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
                      Share
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium text-white/80">Public link</p>
                        <p className="mt-0.5 text-[11px] text-white/35">
                          Anyone with the link can view this conversation.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleShare}
                        disabled={shareLoading}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none disabled:opacity-50 ${
                          shareConv.is_public
                            ? "border-[#3ecf8e] bg-[#3ecf8e]"
                            : "border-white/20 bg-white/[0.06]"
                        }`}
                        aria-label={shareConv.is_public ? "Unpublish" : "Publish"}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            shareConv.is_public ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    {shareConv.is_public && shareConv.share_token ? (
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
                          <Link2 className="h-3 w-3 shrink-0 text-white/30" aria-hidden />
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/55">
                            {typeof window !== "undefined"
                              ? `${window.location.origin}/chat/${shareConv.share_token}`
                              : `/chat/${shareConv.share_token}`}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              const url =
                                typeof window !== "undefined"
                                  ? `${window.location.origin}/chat/${shareConv.share_token}`
                                  : `/chat/${shareConv.share_token}`;
                              if (await copyToClipboard(url)) {
                                setShareCopied(true);
                                setTimeout(() => setShareCopied(false), 1500);
                              }
                            }}
                            className="shrink-0 text-[10px] text-white/40 transition-colors hover:text-white/70"
                          >
                            {shareCopied ? (
                              <Check className="h-3 w-3 text-[#3ecf8e]" aria-hidden />
                            ) : (
                              <Copy className="h-3 w-3" aria-hidden />
                            )}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-6 sm:px-6 lg:max-w-3xl lg:px-8 xl:max-w-5xl 2xl:max-w-6xl">
          {!loaded && messages.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[12px] text-white/35">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading conversation…
            </div>
          ) : null}

          {loaded && messages.length === 0 ? (
            <ChatWelcomePanel onPrompt={(p) => {
              setInput(p);
              textareaRef.current?.focus();
            }} />
          ) : null}

          {messages.map((m, i) => {
            const isLastAssistant =
              m.role === "assistant" && m.id === lastAssistantId;
            const isUser = m.role === "user";
            // Edits are only safe on persisted messages (DB-issued UUIDs);
            // local placeholders use `local-*` ids and would 404 on the server.
            const isPersisted = !m.id.startsWith("local-");
            return (
              <ChatBubble
                key={m.id}
                message={m}
                prevRole={i > 0 ? messages[i - 1].role : null}
                streaming={
                  isStreaming &&
                  i === messages.length - 1 &&
                  m.role === "assistant"
                }
                onRegenerate={
                  isLastAssistant && !isStreaming ? handleRegenerate : undefined
                }
                onEdit={
                  isUser && isPersisted && !isStreaming
                    ? (next) => handleEditUser(m.id, next)
                    : undefined
                }
                onIterateImage={
                  m.role === "assistant" && !isStreaming
                    ? handleIterateImage
                    : undefined
                }
              />
            );
          })}

          {error ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-200/85">
              <span className="min-w-0 flex-1 truncate">{error}</span>
              {messages.some((m) => m.role === "user") ? (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-red-400/30 bg-red-500/[0.08] px-2 py-0.5 text-[11px] font-medium text-red-100 transition-colors hover:border-red-400/50 hover:bg-red-500/[0.14]"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden />
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-2xl lg:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
          {/* Slash command autocomplete */}
          {slashOpen && filteredCommands.length > 0 && (
            <div className="mb-1.5 overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1a1a] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className="border-b border-white/[0.05] px-3 py-1.5">
                <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">Commands</span>
              </div>
              <ul>
                {filteredCommands.map((cmd, idx) => (
                  <li key={cmd.command}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const newVal = cmd.command + " ";
                        setInput(newVal);
                        setSlashOpen(false);
                        requestAnimationFrame(() => {
                          const el = textareaRef.current;
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
                            el.setSelectionRange(newVal.length, newVal.length);
                            el.focus();
                          }
                        });
                      }}
                      className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors ${
                        idx === slashIndex
                          ? "bg-white/[0.05] text-white"
                          : "text-white/70 hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-[12px] text-[#3ecf8e]/80">
                        {cmd.command}
                      </span>
                      <span className="text-[11px] text-white/40">{cmd.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.key}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
                    att.error
                      ? "border-red-500/30 bg-red-500/[0.06] text-red-300"
                      : "border-white/[0.08] bg-white/[0.04] text-white/70"
                  }`}
                >
                  {att.uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-white/40" aria-hidden />
                  ) : att.kind === "image" && att.publicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.publicUrl}
                      alt=""
                      className="h-4 w-4 rounded object-cover"
                    />
                  ) : (
                    <Paperclip className="h-3 w-3 text-white/40" aria-hidden />
                  )}
                  <span className="max-w-[120px] truncate">
                    {att.error ? att.error : att.name}
                  </span>
                  {!att.uploading && (
                    <span className="text-white/30">{formatBytes(att.size)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((a) => a.key !== att.key))
                    }
                    aria-label={`Remove ${att.name}`}
                    className="ml-0.5 text-white/30 transition-colors hover:text-white/70"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Textarea container with drag-and-drop */}
          <div
            className={`relative rounded-xl border bg-[#171717] transition-colors focus-within:border-white/[0.16] ${
              dragOver
                ? "border-[#3ecf8e]/50 bg-[#3ecf8e]/[0.03]"
                : "border-white/[0.08]"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[#3ecf8e]/50">
                <span className="text-[13px] text-[#3ecf8e]/70">Drop files here</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              onPaste={handlePaste}
              disabled={isStreaming}
              placeholder="Message Chat AI…"
              className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-14 text-[14px] leading-relaxed text-white placeholder:text-white/25 focus:outline-none disabled:opacity-60"
              style={{ minHeight: "56px", maxHeight: "200px" }}
            />
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-2">
                <ModelSelector model={model} onSelect={handleSelectModel} />
                <ModeSelector mode={mode} onSelect={handleSelectMode} />
                {/* Paperclip / file picker */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || attachments.length >= MAX_ATTACHMENTS}
                  title="Attach file"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-white/40 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40 sm:h-6 sm:w-6"
                >
                  <Paperclip className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden />
                </button>
              </div>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] text-white/80 transition-colors hover:border-white/[0.2] hover:bg-white/[0.08] sm:h-8 sm:w-8"
                  aria-label="Stop generating"
                >
                  <Square className="h-3.5 w-3.5 fill-current sm:h-3 sm:w-3" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#3ecf8e] text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/30 sm:h-8 sm:w-8"
                  aria-label="Send message"
                >
                  {anyUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" aria-hidden />
                  ) : (
                    <ArrowUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
                  )}
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 hidden text-center text-[11px] text-white/20 sm:block">
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

/* -------------------------------------------------------------------------- */
/*  Chat welcome / empty state (shown when messages.length === 0 && loaded)   */
/* -------------------------------------------------------------------------- */

const TOOL_GROUPS = [
  {
    label: "Web & general",
    icon: Globe,
    tools: ["web_search", "web_fetch", "get_current_time"],
    examples: [
      "What's the latest Next.js version?",
      "What time is it in Jakarta?",
    ],
  },
  {
    label: "VPS",
    icon: Server,
    tools: [
      "vps_list",
      "vps_describe",
      "vps_action",
      "vps_firewall_list",
      "vps_firewall_add",
      "vps_firewall_remove",
      "vps_ssh_keys_list",
      "vps_ssh_bind",
      "vps_ssh_unbind",
      "ssh_run",
    ],
    examples: ["List my VPS instances"],
  },
  {
    label: "Media",
    icon: ImagePlus,
    tools: ["image_generate"],
    examples: ["Generate a logo of a green panther sitting on a server rack"],
  },
] as const;

function ChatWelcomePanel({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="py-8 sm:py-12">
      <div className="mb-6 text-center">
        <h2 className="text-[18px] font-medium tracking-[-0.01em] text-white">
          What can I ask?
        </h2>
        <p className="mt-1.5 text-[13px] text-white/45">
          Chat AI can use these tools to help you.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {TOOL_GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.label}
              className="rounded-lg border border-white/[0.07] bg-[#171717] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-[#3ecf8e]/70">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="text-[12px] font-medium text-white/70">
                  {group.label}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                {group.tools.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-white/35"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                {group.examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => onPrompt(ex)}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-left text-[12px] text-white/55 transition-colors hover:border-[#3ecf8e]/20 hover:bg-[#3ecf8e]/[0.04] hover:text-white/80"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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

/* -------------------------------------------------------------------------- */
/*  Message actions menu (⋯)                                                  */
/* -------------------------------------------------------------------------- */

function MessageActionsMenu({
  onCopy,
  copied,
  onEdit,
  onRegenerate,
}: {
  onCopy: () => void;
  copied: boolean;
  onEdit?: () => void;
  onRegenerate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Message actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/[0.06] bg-white/[0.02] text-white/40 transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/75 sm:h-6 sm:w-6"
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-1.5 min-w-[148px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1a1a] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <button
            type="button"
            onClick={() => { setOpen(false); onCopy(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            {copied ? (
              <Check className="h-3 w-3 shrink-0 text-[#3ecf8e]" aria-hidden />
            ) : (
              <Copy className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Pencil className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
              Edit
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              onClick={() => { setOpen(false); onRegenerate(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <RefreshCw className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ChatBubble({
  message,
  prevRole,
  streaming,
  onRegenerate,
  onEdit,
  onIterateImage,
}: {
  message: ChatMessage;
  prevRole: ChatMessage["role"] | null;
  streaming?: boolean;
  onRegenerate?: () => void;
  onEdit?: (nextContent: string) => void;
  onIterateImage?: (url: string) => void;
}) {
  const isUser = message.role === "user";
  const isFirstInGroup = prevRole !== message.role;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const el = editTextareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [editing]);

  const handleCopy = useCallback(async () => {
    if (await copyToClipboard(message.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [message.content]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === message.content) {
      setDraft(message.content);
      return;
    }
    onEdit?.(next);
  }, [draft, message.content, onEdit]);

  const cancelEdit = useCallback(() => {
    setDraft(message.content);
    setEditing(false);
  }, [message.content]);

  if (isUser) {
    if (editing) {
      return (
        <div className={`flex justify-end ${isFirstInGroup ? "mt-5" : "mt-1"}`}>
          <div className="w-full max-w-[80%] rounded-2xl rounded-br-md border border-[#3ecf8e]/25 bg-[#3ecf8e]/[0.06] p-2">
            <textarea
              ref={editTextareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              maxLength={20_000}
              rows={1}
              className="block w-full resize-none rounded-lg bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-white placeholder:text-white/25 outline-none"
              style={{ maxHeight: "240px" }}
            />
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex h-7 items-center rounded-md px-2.5 text-[12px] text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitEdit}
                disabled={!draft.trim() || draft.trim() === message.content}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-[#3ecf8e] px-2.5 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/30"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`group flex justify-end ${isFirstInGroup ? "mt-5" : "mt-1"}`}>
        <div className="flex max-w-[80%] flex-col items-end">
          <div className="whitespace-pre-wrap rounded-2xl rounded-br-md border border-[#3ecf8e]/12 bg-[#3ecf8e]/[0.07] px-4 py-3 text-[14px] leading-relaxed text-white/90">
            {message.content}
          </div>
          <div className="mt-1.5 flex items-center justify-end">
            <MessageActionsMenu
              onCopy={handleCopy}
              copied={copied}
              onEdit={onEdit ? () => { setDraft(message.content); setEditing(true); } : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  const showActions = !streaming && message.content.length > 0;

  return (
    <div className={`group flex items-start gap-2.5 ${isFirstInGroup ? "mt-5" : "mt-1"}`}>
      {isFirstInGroup ? (
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/40">
          <Sparkles className="h-3 w-3" aria-hidden />
        </span>
      ) : (
        <span className="inline-flex h-6 w-6 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-white/80">
        {/* Tool call cards — rendered above the markdown body */}
        {message.toolEvents && message.toolEvents.length > 0 && (
          <div className="mb-2 flex flex-col gap-1.5">
            {message.toolEvents.map((evt) => (
              <ToolCard key={evt.call_id} event={evt} />
            ))}
          </div>
        )}
        <AssistantMarkdown
          content={message.content}
          streaming={streaming}
          onIterateImage={message.role === "assistant" ? onIterateImage : undefined}
        />
        {streaming && message.content === "" && (!message.toolEvents || message.toolEvents.length === 0) ? (
          <span className="inline-flex items-center gap-1.5 text-white/35">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Thinking…
          </span>
        ) : null}
        {showActions ? (
          <div className="mt-1.5 flex items-center">
            <MessageActionsMenu
              onCopy={handleCopy}
              copied={copied}
              onRegenerate={onRegenerate}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tool call inspector card                                                   */
/* -------------------------------------------------------------------------- */

function ToolCard({ event }: { event: ToolEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = event.status === "done";

  return (
    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px]">
      <div className="flex items-center gap-2">
        {isDone ? (
          <Check className="h-3 w-3 shrink-0 text-[#3ecf8e]" aria-hidden />
        ) : (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-white/40" aria-hidden />
        )}
        <span className="flex-1 font-mono text-white/60">
          {isDone ? "" : "Running "}
          <span className="text-white/80">{event.name}</span>
          {isDone ? "" : "…"}
        </span>
        {isDone && (event.args !== undefined || event.result !== undefined) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-white/35 transition-colors hover:text-white/65"
          >
            {expanded ? "Hide" : "Show details"}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          {event.args !== undefined && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-white/30">Args</p>
              <pre className="overflow-x-auto rounded border border-white/[0.06] bg-[#0f0f0f] p-2 font-mono text-[11px] leading-relaxed text-white/70">
                {JSON.stringify(event.args, null, 2)}
              </pre>
            </div>
          )}
          {event.result !== undefined && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-white/30">Result</p>
              <pre className="overflow-x-auto rounded border border-white/[0.06] bg-[#0f0f0f] p-2 font-mono text-[11px] leading-relaxed text-white/70">
                {JSON.stringify(event.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditableTitle({
  title,
  onSave,
}: {
  title: string;
  onSave: (next: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onSave(next);
    else setDraft(title);
  }, [draft, onSave, title]);

  const cancel = useCallback(() => {
    setDraft(title);
    setEditing(false);
  }, [title]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        maxLength={200}
        className="min-w-0 flex-1 truncate rounded border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 text-[15px] font-medium tracking-[-0.01em] text-white outline-none focus:border-[#3ecf8e]/40"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(title);
        setEditing(true);
      }}
      title="Rename conversation"
      className="group/title inline-flex min-w-0 items-center gap-1.5 rounded text-left hover:bg-white/[0.03]"
    >
      <h2 className="truncate text-[15px] font-medium tracking-[-0.01em] text-white">
        {title}
      </h2>
      <Pencil
        className="h-3 w-3 shrink-0 text-white/20 opacity-0 transition-opacity group-hover/title:opacity-100"
        aria-hidden
      />
    </button>
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
  const known = CHAT_MODELS.find((m) => m.slug === model);
  // When the conversation's model isn't in the catalogue (e.g. it was created
  // when the env-default pointed at a different slug), don't snap to the first
  // option — show the raw slug so the UI mirrors the database.
  const buttonLabel = known?.slug ?? model ?? "default";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group flex items-center gap-1.5 rounded-md border px-2 py-1.5 font-mono text-[11px] tracking-tight transition-colors sm:py-1 ${
          open
            ? "border-white/[0.14] bg-white/[0.05] text-white/80"
            : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/80"
        }`}
      >
        <Sparkles className="h-3 w-3 text-[#3ecf8e]/70" aria-hidden />
        <span className="max-w-[120px] truncate sm:max-w-[140px]">{buttonLabel}</span>
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
          <div className="absolute bottom-full left-0 z-20 mb-2 w-[calc(100vw-2rem)] max-w-[260px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1a1a] shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-black/30 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                Choose model
              </span>
              <span className="text-[10px] text-white/25">{CHAT_MODELS.length}</span>
            </div>
            {!known && model ? (
              <div className="border-b border-white/[0.06] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-amber-300">
                    custom
                  </span>
                  <span className="truncate font-mono text-[11px] text-white/55">
                    {model}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-white/30">
                  Stored model isn&apos;t in the catalogue. Pick one below to switch.
                </p>
              </div>
            ) : null}
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

/* -------------------------------------------------------------------------- */
/*  Mode selector dropdown                                                    */
/* -------------------------------------------------------------------------- */

function ModeSelector({
  mode,
  onSelect,
}: {
  mode: ChatMode;
  onSelect: (slug: ChatMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = CHAT_MODES.find((m) => m.slug === mode) ?? CHAT_MODES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group flex items-center gap-1.5 rounded-md border px-2 py-1.5 font-mono text-[11px] tracking-tight transition-colors sm:py-1 ${
          open
            ? "border-white/[0.14] bg-white/[0.05] text-white/80"
            : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/80"
        }`}
        aria-label="Choose conversation mode"
      >
        <ImagePlus
          className={`h-3 w-3 ${
            mode === "image" ? "text-[#3ecf8e]/80" : "text-white/40"
          }`}
          aria-hidden
        />
        <span className="max-w-[80px] truncate sm:max-w-[120px]">{current.name}</span>
        <ChevronUp
          className={`h-3 w-3 text-white/30 transition-transform group-hover:text-white/55 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            aria-label="Close mode picker"
            onClick={() => setOpen(false)}
          />

          <div className="absolute bottom-full left-0 z-20 mb-2 w-[calc(100vw-2rem)] max-w-[240px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1a1a] shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-black/30 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                Mode
              </span>
              <span className="text-[10px] text-white/25">{CHAT_MODES.length}</span>
            </div>
            <ul className="p-1.5">
              {CHAT_MODES.map((m) => {
                const selected = mode === m.slug;
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
                        {m.slug === "image" ? (
                          <ImagePlus className="h-3 w-3" />
                        ) : (
                          <MessageSquare className="h-3 w-3" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-tight">
                          {m.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-white/35">
                          {m.description}
                        </span>
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

function AssistantMarkdown({
  content,
  streaming,
  onIterateImage,
}: {
  content: string;
  streaming?: boolean;
  onIterateImage?: (url: string) => void;
}) {
  // While streaming: keep raw content updating immediately (shown as pre),
  // and debounce the parsed markdown render by 80ms. Switch to markdown-only
  // once stable (streaming ended or content hasn't changed for 80ms).
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [isStable, setIsStable] = useState(!streaming);

  useEffect(() => {
    if (!streaming) {
      setDebouncedContent(content);
      setIsStable(true);
      return;
    }
    setIsStable(false);
    const id = setTimeout(() => {
      setDebouncedContent(content);
      setIsStable(true);
    }, 80);
    return () => clearTimeout(id);
  }, [content, streaming]);

  // Fix dangling unclosed code fence so ReactMarkdown doesn't swallow the rest
  function closeFences(src: string): string {
    const count = (src.match(/```/g) ?? []).length;
    return count % 2 !== 0 ? src + "\n```" : src;
  }

  const renderContent = isStable ? debouncedContent : closeFences(debouncedContent);

  return (
    <div className="markdown">
      {streaming && !isStable && content.length > 0 ? (
        // Show raw text while debounce is pending to avoid flicker
        <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-white/80">
          {content}
        </pre>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // react-markdown v9 dropped the `inline` prop. Fenced code blocks
            // always carry a `language-*` class (set by the parser) and live
            // inside a `<pre>`; inline code has no class. We use the class as
            // the discriminator and override `pre` below to unwrap the wrapper.
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              if (!match) {
                return (
                  <code
                    className="mx-0.5 rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px] text-[#3ecf8e]/75"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              const lang = match[1] ?? null;
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
            img({ src, alt }) {
              const url = typeof src === "string" ? src : undefined;
              const isGenerated = !!url && /\/generated-images\//.test(url);
              return (
                <span className="my-3 inline-block max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={alt ?? ""}
                    loading="lazy"
                    className="block max-w-full h-auto rounded-lg border border-white/[0.08]"
                  />
                  {isGenerated && onIterateImage && url ? (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onIterateImage(url)}
                        title="Iterate on this image"
                        className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[11px] text-white/55 transition-colors hover:border-[#3ecf8e]/30 hover:bg-[#3ecf8e]/[0.06] hover:text-[#3ecf8e]"
                      >
                        <Sparkles className="h-3 w-3" aria-hidden />
                        Iterate
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[11px] text-white/40 transition-colors hover:border-white/[0.12] hover:text-white/70"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        Open
                      </a>
                    </span>
                  ) : null}
                </span>
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
                <div className="-mx-1 my-3 overflow-x-auto rounded-md border border-white/[0.08] sm:mx-0">
                  <table className="w-full min-w-max border-collapse text-[12px] sm:text-[13px]">
                    {children}
                  </table>
                </div>
              );
            },
            thead({ children }) {
              return <thead className="bg-white/[0.03]">{children}</thead>;
            },
            th({ children }) {
              return (
                <th className="whitespace-nowrap border-b border-white/[0.06] px-2.5 py-1.5 text-left font-medium text-white/70 sm:px-3">
                  {children}
                </th>
              );
            },
            td({ children }) {
              return (
                <td className="whitespace-nowrap border-b border-white/[0.04] px-2.5 py-1.5 align-top sm:px-3">
                  {children}
                </td>
              );
            },
          }}
        >
          {renderContent}
        </ReactMarkdown>
      )}
    </div>
  );
}

function CodeBubble({ lang, code }: { lang: string | null; code: string }) {
  const isSingleLine = !code.includes("\n") && code.trim().length <= 80;
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (await copyToClipboard(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
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
