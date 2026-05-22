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
  Trash2,
  ThumbsUp,
  ThumbsDown,
  X,
} from "lucide-react";
import hljs from "highlight.js/lib/common";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "@/components/ui/MermaidDiagram";
import type { InlineSshTerminalHandle } from "./chat/inline-terminal";
import { InlineSshTerminal } from "./chat/inline-terminal";

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

// ─── Live stream cache ────────────────────────────────────────────────────────
// Module-level state that persists across ChatView remounts. When the user
// navigates away mid-generation and comes back, the new ChatView subscribes
// here instead of loading from DB (which has no assistant message yet).

type LiveListener = (msgs: ChatMessage[] | null) => void; // null = stream ended
const _liveCache = new Map<string, ChatMessage[]>();
const _liveListeners = new Map<string, Set<LiveListener>>();

function _publishLive(id: string, msgs: ChatMessage[]): void {
  _liveCache.set(id, msgs);
  _liveListeners.get(id)?.forEach((fn) => fn(msgs));
}

function _endLiveStream(id: string): void {
  _liveCache.delete(id);
  const fns = _liveListeners.get(id);
  _liveListeners.delete(id);
  fns?.forEach((fn) => fn(null));
}

function _subscribeLive(id: string, fn: LiveListener): () => void {
  if (!_liveListeners.has(id)) _liveListeners.set(id, new Set());
  _liveListeners.get(id)!.add(fn);
  return () => _liveListeners.get(id)?.delete(fn);
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Draft input cache ────────────────────────────────────────────────────────
// Persists unsent message text across ChatView remounts (e.g. navigating away
// and back). Keyed by conversation ID. Cleared when the message is sent.
const _draftCache = new Map<string, string>();
// ─────────────────────────────────────────────────────────────────────────────

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
  onStreamingChange,
  onDelete,
}: {
  conversation: ChatConversationSummary;
  defaultModel?: string;
  onConversationUpdated?: (c: ChatConversationSummary) => void;
  onStreamingChange?: (conversationId: string, streaming: boolean) => void;
  onDelete?: (id: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(() => _draftCache.get(conversation.id) ?? "");
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

  // Inline terminal sessions opened by the AI via open_terminal
  const [terminalSessions, setTerminalSessions] = useState<
    Map<string, { instanceName: string; ref: React.RefObject<InlineSshTerminalHandle | null> }>
  >(new Map());

  // Share dropdown
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareConv, setShareConv] = useState<ChatConversationSummary>(conversation);
  const [shareCopied, setShareCopied] = useState(false);

  // ⋯ more-menu dropdown
  const [moreOpen, setMoreOpen] = useState(false);

  // Inline header rename (triggered from ⋯ menu)
  const [headerRenaming, setHeaderRenaming] = useState(false);
  const [headerRenameDraft, setHeaderRenameDraft] = useState("");
  const headerRenameRef = useRef<HTMLInputElement | null>(null);

  // Keep shareConv in sync when conversation prop changes (e.g. after sidebar update)
  useEffect(() => {
    setShareConv(conversation);
  }, [conversation]);

  // Hydrate messages once per mount. The parent shell remounts this view on
  // conversation change via `key={conversation.id}`, so we don't need to reset
  // local state inside the effect.
  useEffect(() => {
    let cancelled = false;

    // If generation is still in-flight for this conversation (user navigated
    // away and back), re-attach to the live stream cache so tool call
    // indicators and partial text stay visible.
    const liveMsgs = _liveCache.get(conversation.id);
    if (liveMsgs !== undefined) {
      setMessages(liveMsgs);
      setIsStreaming(true);
      setLoaded(true);

      const unsub = _subscribeLive(conversation.id, (msgs) => {
        if (cancelled) return;
        if (msgs === null) {
          // Stream finished — load from DB to get the persisted assistant message.
          setIsStreaming(false);
          fetch(`/api/conversations/${conversation.id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (cancelled || !data) return;
              const d = data as { messages: ChatMessage[] };
              setMessages(d.messages);
            })
            .catch(() => {/* ignore; messages already show the final state */});
        } else {
          setMessages(msgs);
        }
      });

      return () => {
        cancelled = true;
        unsub();
      };
    }

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

  // Intentionally not aborting on unmount: background generation should
  // complete and persist to DB even when the user navigates to another
  // conversation or tool. The Stop button still works via handleStop().

  // Wrapper that keeps local isStreaming in sync, notifies the parent shell
  // (sub-sidebar spinner), and manages the module-level live stream cache.
  const notifyStreaming = useCallback(
    (value: boolean) => {
      setIsStreaming(value);
      onStreamingChange?.(conversation.id, value);
      if (!value) {
        // Signal subscribers (re-mounted ChatViews) that the stream ended, then
        // clear the cache so the next mount loads fresh data from DB.
        _endLiveStream(conversation.id);
      }
    },
    [conversation.id, onStreamingChange],
  );

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

      // Helper: apply an updater, capture the result, and publish to live cache.
      // Functional updaters run synchronously, so `captured` is set before we
      // call _publishLive.
      const applyAndPublish = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
        let captured: ChatMessage[] = [];
        setMessages((prev) => {
          captured = updater(prev);
          return captured;
        });
        _publishLive(conversation.id, captured);
      };

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
            follow_ups?: unknown[];
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
            applyAndPublish((prev) =>
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

            // When open_terminal succeeds, register an inline terminal session
            if (
              toolEvt.name === "open_terminal" &&
              toolEvt.status === "done" &&
              toolEvt.result &&
              typeof toolEvt.result === "object" &&
              (toolEvt.result as Record<string, unknown>).ok === true
            ) {
              const res = toolEvt.result as {
                instance_id: string;
                instance_name: string;
              };
              setTerminalSessions((prev) => {
                if (prev.has(res.instance_id)) return prev;
                const next = new Map(prev);
                next.set(res.instance_id, {
                  instanceName: res.instance_name,
                  ref: { current: null } as React.RefObject<InlineSshTerminalHandle | null>,
                });
                return next;
              });
            }

            applyAndPublish((prev) => {
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
          if (parsed.follow_ups && Array.isArray(parsed.follow_ups)) {
            const followUps = (parsed.follow_ups as unknown[]).filter(
              (q): q is string => typeof q === "string",
            );
            applyAndPublish((prev) => {
              const next = prev.slice();
              const last = next[next.length - 1];
              if (last && last.id === currentAssistantId) {
                next[next.length - 1] = { ...last, followUps };
              }
              return next;
            });
          }
          if (parsed.delta) {
            applyAndPublish((prev) => {
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
    [conversation.id],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || isStreaming) return;
    // Block send while any attachment is still uploading (skip for follow-ups)
    if (!overrideText && attachments.some((a) => a.uploading)) return;

    const readyAttachments = overrideText ? [] : attachments.filter((a) => !a.error);

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
    if (!overrideText) {
      setInput("");
      _draftCache.delete(conversation.id);
      setAttachments([]);
      setSlashOpen(false);
    }
    notifyStreaming(true);
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
      notifyStreaming(false);
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
    notifyStreaming,
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
    notifyStreaming(true);
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
      notifyStreaming(false);
    }
  }, [
    consumeStream,
    conversation.id,
    conversation.title,
    isStreaming,
    messages,
    model,
    mode,
    notifyStreaming,
    onConversationUpdated,
  ]);

  const handleFollowUp = useCallback(
    (text: string) => { handleSend(text); },
    [handleSend],
  );

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
      notifyStreaming(true);
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
        notifyStreaming(false);
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
      notifyStreaming,
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
    // Persist draft so it survives navigation away and back.
    if (val) {
      _draftCache.set(conversation.id, val);
    } else {
      _draftCache.delete(conversation.id);
    }
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

  // Header rename (triggered from ⋯ menu)
  const openHeaderRename = useCallback(() => {
    setHeaderRenameDraft(conversation.title);
    setHeaderRenaming(true);
    setMoreOpen(false);
  }, [conversation.title]);

  const commitHeaderRename = useCallback(() => {
    setHeaderRenaming(false);
    const next = headerRenameDraft.trim();
    if (next && next !== conversation.title) void handleRename(next);
    else setHeaderRenameDraft(conversation.title);
  }, [headerRenameDraft, conversation.title, handleRename]);

  // Auto-focus rename input when it opens
  useEffect(() => {
    if (headerRenaming) {
      requestAnimationFrame(() => {
        headerRenameRef.current?.focus();
        headerRenameRef.current?.select();
      });
    }
  }, [headerRenaming]);

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

  // Approve or deny a terminal_run command proposed by the AI.
  // Resolves the server-side pending approval and injects the command when approved.
  const handleApproveTerminalCommand = useCallback(
    async (
      callId: string,
      command: string,
      instanceId: string | undefined,
      approved: boolean,
    ) => {
      // Resolve the server-side blocking promise
      await fetch(`/api/terminal/approve/${callId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      }).catch(() => {/* best-effort */});

      // Inject command into the terminal when approved
      if (approved) {
        const session = instanceId
          ? terminalSessions.get(instanceId)
          : [...terminalSessions.values()][0];
        session?.ref.current?.injectInput(command + "\n");
      }
    },
    [terminalSessions],
  );

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  // Header tab state: "answer" | "links" | "images"
  const [tab, setTab] = useState<"answer" | "links" | "images">("answer");

  // Auto-return to answer tab when streaming starts (new content incoming)
  useEffect(() => {
    if (isStreaming) setTab("answer");
  }, [isStreaming]);

  // Collect all sources from every message in the conversation
  const allSources = useMemo(
    () => extractSources(messages.flatMap((m) => m.toolEvents ?? [])),
    [messages],
  );

  // Collect all generated images from every message in the conversation
  const allImages = useMemo((): Array<{ url: string; prompt: string }> => {
    const seen = new Set<string>();
    const imgs: Array<{ url: string; prompt: string }> = [];
    for (const msg of messages) {
      for (const evt of msg.toolEvents ?? []) {
        if (evt.status !== "done" || !evt.result) continue;
        if (evt.name === "image_generate" || evt.name === "image_edit") {
          const r = evt.result as { url?: string; prompt?: string };
          if (r.url && !seen.has(r.url)) {
            seen.add(r.url);
            imgs.push({ url: r.url, prompt: r.prompt ?? "" });
          }
        }
      }
    }
    return imgs;
  }, [messages]);

  const anyUploading = attachments.some((a) => a.uploading);
  const canSend = !!input.trim() && !isStreaming && !anyUploading;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header — Perplexity-inspired */}
      <header className="relative flex h-[52px] shrink-0 items-center border-b border-white/[0.06] px-4 sm:px-6 lg:px-8">
        {/* Tabs / rename — centered with content column */}
        <div className="mx-auto flex h-[52px] w-full max-w-[720px] items-stretch">
          {headerRenaming ? (
            <div className="flex min-w-0 flex-1 items-center px-2">
              <input
                ref={headerRenameRef}
                value={headerRenameDraft}
                onChange={(e) => setHeaderRenameDraft(e.target.value)}
                onBlur={commitHeaderRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitHeaderRename(); }
                  if (e.key === "Escape") { e.preventDefault(); setHeaderRenaming(false); }
                }}
                maxLength={200}
                className="w-full rounded border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-center text-[13px] text-white/80 outline-none focus:border-[#3ecf8e]/40"
              />
            </div>
          ) : (
            <div className="flex h-[52px] flex-1 items-stretch pr-24">
              <ConversationTab
                icon={Sparkles}
                label="Answer"
                active={tab === "answer"}
                onClick={() => setTab("answer")}
              />
              <ConversationTab
                icon={Globe}
                label="Links"
                count={allSources.length}
                active={tab === "links"}
                onClick={() => setTab("links")}
              />
              <ConversationTab
                icon={ImagePlus}
                label="Images"
                count={allImages.length}
                active={tab === "images"}
                onClick={() => setTab("images")}
              />
            </div>
          )}
        </div>

        {/* Right actions — pinned to the full viewport right edge */}
        <div className="absolute right-4 top-0 flex h-full items-center gap-1.5 sm:right-6 lg:right-8">

            {/* ⋯ more-options button */}
            <button
              type="button"
              onClick={() => { setMoreOpen((v) => !v); setShareOpen(false); }}
              aria-label="More options"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                moreOpen
                  ? "bg-white/[0.07] text-white/70"
                  : "text-white/40 hover:bg-white/[0.06] hover:text-white/60"
              }`}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>

            {/* ⋯ dropdown */}
            {moreOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close menu"
                  onClick={() => setMoreOpen(false)}
                />
                <div className="absolute right-16 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1c1c1c] shadow-[0_16px_48px_rgba(0,0,0,0.65)] ring-1 ring-black/20">
                  {/* Thread info */}
                  <div className="border-b border-white/[0.06] px-4 py-3.5">
                    <p className="line-clamp-2 text-[14px] font-medium leading-snug text-white">
                      {conversation.title}
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white/35">Last updated</span>
                        <span className="text-[11px] text-white/55">
                          {formatRelative(conversation.updated_at)}
                        </span>
                      </div>
                      {model ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white/35">Model</span>
                          <span className="font-mono text-[10px] text-[#3ecf8e]/70">{model}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="py-1.5">
                    <button
                      type="button"
                      onClick={openHeaderRename}
                      className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-white/65 transition-colors hover:bg-white/[0.04] hover:text-white/90"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
                      Rename Thread
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMoreOpen(false); handleExport(); }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-white/65 transition-colors hover:bg-white/[0.04] hover:text-white/90"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
                      Export as Markdown
                    </button>
                  </div>

                  <div className="border-t border-white/[0.06] py-1.5">
                    <button
                      type="button"
                      onClick={() => { setMoreOpen(false); onDelete?.(conversation.id); }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-red-400/75 transition-colors hover:bg-red-500/[0.06] hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Delete
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Share button */}
            <button
              type="button"
              onClick={() => { setShareOpen((v) => !v); setMoreOpen(false); }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                shareOpen
                  ? "border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.08] text-[#3ecf8e]/80"
                  : "border-white/[0.1] text-white/55 hover:border-white/[0.18] hover:text-white/80"
              }`}
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              Share
            </button>

            {/* Share dropdown */}
            {shareOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close share panel"
                  onClick={() => setShareOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-2 w-[calc(100vw-2rem)] max-w-[280px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#1c1c1c] shadow-[0_16px_48px_rgba(0,0,0,0.65)] ring-1 ring-black/20">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
                      Share
                    </span>
                  </div>
                  <div className="p-4">
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
      </header>

      {/* ── Answer tab: messages + terminals ── */}
      <div className={tab !== "answer" ? "hidden" : "flex flex-1 flex-col overflow-hidden"}>

      {/* Messages */}
      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mt-auto flex w-full max-w-[720px] flex-col py-6">
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
                onApproveTerminalCommand={handleApproveTerminalCommand}
                onFollowUp={
                  isLastAssistant && !isStreaming ? handleFollowUp : undefined
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

      {/* Inline terminal panels — shown when AI opens a terminal session */}
      {terminalSessions.size > 0 && (
        <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3 pb-0 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[720px] space-y-2">
            {[...terminalSessions.entries()].map(([instanceId, session]) => (
              <InlineSshTerminal
                key={instanceId}
                ref={session.ref}
                instanceId={instanceId}
                instanceName={session.instanceName}
                onClose={() =>
                  setTerminalSessions((prev) => {
                    const next = new Map(prev);
                    next.delete(instanceId);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ── End answer tab ── */}
      </div>

      {/* ── Links tab ── */}
      {tab === "links" && <LinksTabView sources={allSources} />}

      {/* ── Images tab ── */}
      {tab === "images" && (
        <ImagesTabView images={allImages} onIterateImage={handleIterateImage} />
      )}

      {/* ── Input — always at the absolute bottom ── */}
      <div className="shrink-0 px-4 pt-3 pb-3 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[720px]">
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

          {/* Prompt box */}
          <div
            className={`rounded-2xl bg-[#141414] transition-colors ${
              dragOver ? "bg-[#3ecf8e]/[0.03]" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-[#3ecf8e]/50">
                <span className="text-[13px] text-[#3ecf8e]/70">Drop files here</span>
              </div>
            )}

            {/* Text area */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              onPaste={handlePaste}
              disabled={isStreaming}
              placeholder="Ask a follow-up"
              className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[14px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none disabled:opacity-60"
              style={{ minHeight: "52px", maxHeight: "200px" }}
            />

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {attachments.map((att) => (
                  <div
                    key={att.key}
                    className="group relative flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5"
                  >
                    {att.uploading ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/40" aria-hidden />
                    ) : att.error ? (
                      <X className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
                    ) : att.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.publicUrl} alt={att.name} className="h-5 w-5 rounded object-cover" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden />
                    )}
                    <span className="max-w-[120px] truncate text-[11px] text-white/60">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.key !== att.key))}
                      className="ml-0.5 text-white/25 transition-colors hover:text-white/60"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="mx-4 h-px bg-white/[0.06]" />

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              {/* Left — attach + mode */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || attachments.length >= MAX_ATTACHMENTS}
                  title="Attach file"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
                <ModeSelector mode={mode} onSelect={handleSelectMode} />
              </div>

              {/* Right — model + send */}
              <div className="flex items-center gap-2">
                <ModelSelector model={model} onSelect={handleSelectModel} />
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white/70 transition-colors hover:border-white/[0.2] hover:bg-white/[0.08]"
                    aria-label="Stop generating"
                  >
                    <Square className="h-3 w-3 fill-current" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!canSend}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#3ecf8e] text-[#0a0a0a] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/25"
                    aria-label="Send message"
                  >
                    {anyUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="mt-1 hidden text-center text-[11px] text-white/20 sm:block">
            <kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{" "}
            to send ·{" "}
            <kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd>{" "}
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
/*  Header tab button                                                          */
/* -------------------------------------------------------------------------- */

function ConversationTab({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-[52px] items-center gap-1.5 px-3 text-[13px] font-medium transition-colors ${
        active ? "text-white" : "text-white/40 hover:text-white/65"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
      {count != null && count > 0 ? (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            active ? "bg-white/[0.1] text-white/70" : "bg-white/[0.06] text-white/35"
          }`}
        >
          {count}
        </span>
      ) : null}
      {/* Active underline — sits flush against the header bottom border */}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white" />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Links tab view                                                             */
/* -------------------------------------------------------------------------- */

function LinksTabView({ sources }: { sources: Source[] }) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Globe className="h-9 w-9 text-white/15" aria-hidden />
        <p className="text-[14px] text-white/40">No links yet</p>
        <p className="max-w-xs text-[12px] leading-relaxed text-white/25">
          Links appear here when the AI uses web search or fetches pages.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[720px] py-6">
        <p className="mb-4 text-[12px] text-white/30">
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {sources.map((s, i) => {
            let hostname = "";
            try { hostname = new URL(s.url).hostname; } catch {}
            return (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#181818] p-3.5 transition-colors hover:border-white/[0.13] hover:bg-white/[0.03]"
              >
                {/* Favicon */}
                {hostname ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                    alt=""
                    width={16}
                    height={16}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded object-contain opacity-80"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-white/20" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-medium text-white/75 transition-colors group-hover:text-white/90">
                    {s.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-white/30">{hostname}</p>
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/20 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Images tab view                                                            */
/* -------------------------------------------------------------------------- */

function ImagesTabView({
  images,
  onIterateImage,
}: {
  images: Array<{ url: string; prompt: string }>;
  onIterateImage?: (url: string) => void;
}) {
  if (images.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <ImagePlus className="h-9 w-9 text-white/15" aria-hidden />
        <p className="text-[14px] text-white/40">No images yet</p>
        <p className="max-w-xs text-[12px] leading-relaxed text-white/25">
          Images generated during this conversation will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[720px] py-6">
        <p className="mb-4 text-[12px] text-white/30">
          {images.length} {images.length === 1 ? "image" : "images"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <div
              key={i}
              className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.08] bg-[#181818]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.prompt}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/20 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="line-clamp-2 text-[12px] leading-snug text-white/90">
                  {img.prompt}
                </p>
                {onIterateImage && (
                  <button
                    type="button"
                    onClick={() => onIterateImage(img.url)}
                    className="mt-2 self-start rounded-md border border-white/20 bg-white/[0.1] px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm transition-colors hover:bg-white/[0.2]"
                  >
                    Iterate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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

/* -------------------------------------------------------------------------- */
/*  Sources button                                                             */
/* -------------------------------------------------------------------------- */

type Source = { title: string; url: string };

function extractSources(events: ToolEvent[]): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const evt of events) {
    if (evt.status !== "done" || !evt.result) continue;
    if (evt.name === "web_search") {
      const r = evt.result as { results?: Array<{ title?: string; url?: string }> };
      for (const item of r.results ?? []) {
        if (item.url && !seen.has(item.url)) {
          seen.add(item.url);
          sources.push({ title: item.title ?? item.url, url: item.url });
        }
      }
    }
    if (evt.name === "web_fetch") {
      const r = evt.result as { url?: string; title?: string };
      if (r.url && !seen.has(r.url)) {
        seen.add(r.url);
        sources.push({ title: r.title ?? r.url, url: r.url });
      }
    }
  }
  return sources;
}

function SourcesButton({ events }: { events: ToolEvent[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sources = useMemo(() => extractSources(events), [events]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (sources.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-2 text-[11px] text-white/45 transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/75 sm:h-6"
      >
        <Globe className="h-3 w-3 shrink-0" aria-hidden />
        {sources.length} {sources.length === 1 ? "source" : "sources"}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1.5 w-72 overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1a1a] shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-white/30">
            {sources.length} {sources.length === 1 ? "source" : "sources"}
          </p>
          <ul className="max-h-64 overflow-y-auto py-1">
            {sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.04]"
                >
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-white/25" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] text-white/75">{s.title}</p>
                    <p className="truncate text-[10px] text-white/30">{s.url}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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

type ApproveTerminalCommand = (
  callId: string,
  command: string,
  instanceId: string | undefined,
  approved: boolean,
) => void;

function ChatBubble({
  message,
  prevRole,
  streaming,
  onRegenerate,
  onEdit,
  onIterateImage,
  onApproveTerminalCommand,
  onFollowUp,
}: {
  message: ChatMessage;
  prevRole: ChatMessage["role"] | null;
  streaming?: boolean;
  onRegenerate?: () => void;
  onEdit?: (nextContent: string) => void;
  onIterateImage?: (url: string) => void;
  onApproveTerminalCommand?: ApproveTerminalCommand;
  onFollowUp?: (text: string) => void;
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
    <div className={`group ${isFirstInGroup ? "mt-5" : "mt-1"}`}>
      <div className="text-[14px] leading-relaxed text-white/80">
        {/* Tool call cards — individual while streaming, collapsed summary when done */}
        {message.toolEvents && message.toolEvents.length > 0 && (
          <div className="mb-2">
            {streaming ? (
              <div className="flex flex-col gap-1.5">
                {message.toolEvents.map((evt) => (
                  <ToolCard
                    key={evt.call_id}
                    event={evt}
                    onApproveTerminalCommand={onApproveTerminalCommand}
                  />
                ))}
              </div>
            ) : (
              <ToolCallSummary
                events={message.toolEvents}
                onApproveTerminalCommand={onApproveTerminalCommand}
              />
            )}
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
          <div className="mt-3 flex items-center gap-0.5 border-t border-white/[0.05] pt-2.5">
            {/* Left: copy + regenerate */}
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? "Copied!" : "Copy response"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/60"
            >
              {copied
                ? <Check className="h-3.5 w-3.5 text-[#3ecf8e]" aria-hidden />
                : <Copy className="h-3.5 w-3.5" aria-hidden />}
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                title="Regenerate response"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/60"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
            {/* Thumbs — decorative feedback hints */}
            <button
              type="button"
              title="Good response"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/20 transition-colors hover:bg-white/[0.05] hover:text-white/50"
            >
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              title="Bad response"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/20 transition-colors hover:bg-white/[0.05] hover:text-white/50"
            >
              <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right: sources pill + ⋯ */}
            {message.toolEvents && message.toolEvents.length > 0 && (
              <SourcesButton events={message.toolEvents} />
            )}
            <MessageActionsMenu
              onCopy={handleCopy}
              copied={copied}
              onRegenerate={onRegenerate}
            />
          </div>
        ) : null}
        {!streaming && onFollowUp && message.followUps && message.followUps.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold text-white/50">Follow-ups</p>
            <ul className="flex flex-col divide-y divide-white/[0.05]">
              {message.followUps.map((q, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onFollowUp(q)}
                    className="flex w-full items-center gap-2.5 py-2 text-left text-[13px] text-[#3ecf8e]/80 transition-colors hover:text-[#3ecf8e]"
                  >
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tool call summary (Perplexity-style "Completed X steps")                  */
/* -------------------------------------------------------------------------- */

function ToolCallSummary({
  events,
  onApproveTerminalCommand,
}: {
  events: ToolEvent[];
  onApproveTerminalCommand?: ApproveTerminalCommand;
}) {
  const [expanded, setExpanded] = useState(false);

  // Always expand inline for special interactive cards
  const hasInteractive = events.some(
    (e) => e.name === "open_terminal" || e.name === "terminal_run",
  );

  if (hasInteractive) {
    return (
      <div className="flex flex-col gap-1.5">
        {events.map((evt) => (
          <ToolCard key={evt.call_id} event={evt} onApproveTerminalCommand={onApproveTerminalCommand} />
        ))}
      </div>
    );
  }

  const count = events.length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80"
      >
        <span>Completed {count} {count === 1 ? "step" : "steps"}</span>
        <ArrowRight
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        />
      </button>
      {expanded && (
        <div className="mt-2 flex flex-col gap-1.5">
          {events.map((evt) => (
            <ToolCard key={evt.call_id} event={evt} onApproveTerminalCommand={onApproveTerminalCommand} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tool call inspector card                                                   */
/* -------------------------------------------------------------------------- */

function ToolCard({
  event,
  onApproveTerminalCommand,
}: {
  event: ToolEvent;
  onApproveTerminalCommand?: ApproveTerminalCommand;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const isDone = event.status === "done";

  // ── open_terminal card ────────────────────────────────────────────────────
  if (event.name === "open_terminal") {
    const result = isDone
      ? (event.result as Record<string, unknown> | undefined)
      : undefined;
    const ok = result?.ok === true;
    const instanceName =
      typeof result?.instance_name === "string" ? result.instance_name : null;
    const errMsg =
      typeof result?.error === "string" ? result.error : null;

    return (
      <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px]">
        <div className="flex items-center gap-2">
          {!isDone ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-white/40" aria-hidden />
          ) : ok ? (
            <Terminal className="h-3 w-3 shrink-0 text-[#3ecf8e]" aria-hidden />
          ) : (
            <X className="h-3 w-3 shrink-0 text-red-400" aria-hidden />
          )}
          <span className="flex-1 font-mono text-white/60">
            {!isDone
              ? "Opening terminal…"
              : ok
                ? `Terminal open${instanceName ? ` · ${instanceName}` : ""}`
                : `Terminal failed${errMsg ? ` · ${errMsg}` : ""}`}
          </span>
        </div>
      </div>
    );
  }

  // ── terminal_run card ─────────────────────────────────────────────────────
  if (event.name === "terminal_run") {
    const args = event.args as
      | { command?: string; reason?: string; instance_id?: string }
      | undefined;
    const result = isDone
      ? (event.result as Record<string, unknown> | undefined)
      : undefined;
    const command = args?.command ?? "";
    const reason = args?.reason ?? "";
    const instanceId = args?.instance_id as string | undefined;
    const wasApproved = result?.approved === true;

    // Running — show approval UI
    if (!isDone) {
      return (
        <div className="rounded-md border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.04] px-3 py-2.5 text-[12px]">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 shrink-0 text-[#3ecf8e]/70" aria-hidden />
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#3ecf8e]/70">
              Run command?
            </span>
          </div>
          {reason && (
            <p className="mt-1.5 text-[12px] text-white/50">{reason}</p>
          )}
          <pre className="mt-2 overflow-x-auto rounded border border-white/[0.08] bg-[#0a0a0a] px-3 py-2 font-mono text-[12px] leading-relaxed text-white/85">
            {command}
          </pre>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              disabled={approving}
              onClick={async () => {
                setApproving(true);
                await onApproveTerminalCommand?.(event.call_id, command, instanceId, true);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-50"
            >
              {approving ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Terminal className="h-3 w-3" aria-hidden />
              )}
              Run
            </button>
            <button
              type="button"
              disabled={approving}
              onClick={async () => {
                setApproving(true);
                await onApproveTerminalCommand?.(event.call_id, command, instanceId, false);
              }}
              className="inline-flex h-7 items-center rounded-md border border-white/[0.08] px-3 text-[12px] text-white/55 transition-colors hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-400 disabled:opacity-50"
            >
              Deny
            </button>
          </div>
        </div>
      );
    }

    // Done — show outcome
    return (
      <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px]">
        <div className="flex items-center gap-2">
          {wasApproved ? (
            <Check className="h-3 w-3 shrink-0 text-[#3ecf8e]" aria-hidden />
          ) : (
            <X className="h-3 w-3 shrink-0 text-white/30" aria-hidden />
          )}
          <span className="font-mono text-white/60">
            {wasApproved ? "Command approved" : "Command denied"}
            {command ? ` · ` : ""}
          </span>
          {command && (
            <code className="truncate font-mono text-white/50">{command}</code>
          )}
        </div>
      </div>
    );
  }

  // ── default tool card (all other tools) ───────────────────────────────────
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
        className="group flex items-center gap-1 text-[12px] text-white/50 transition-colors hover:text-white/80"
      >
        <span className="max-w-[120px] truncate sm:max-w-[140px]">Model</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
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
        {mode === "image" ? (
          <ImagePlus className="h-3 w-3 text-[#3ecf8e]/80" aria-hidden />
        ) : (
          <Globe className="h-3 w-3 text-white/40" aria-hidden />
        )}
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
              const linkClass =
                "text-[#3ecf8e] underline decoration-[#3ecf8e]/40 underline-offset-2 hover:decoration-[#3ecf8e]";
              // Internal relative paths → Next.js Link (SPA navigation, no reload)
              if (href && href.startsWith("/")) {
                return (
                  <Link href={href} className={linkClass}>
                    {children}
                  </Link>
                );
              }
              // Inline source chip: short external links (≤ 3 words, < 25 chars)
              // These are citation-style links like [Sumber](url) or [Source](url)
              if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
                const childText = String(children ?? "").trim();
                const wordCount = childText.split(/\s+/).filter(Boolean).length;
                if (childText.length < 25 && wordCount <= 3) {
                  let hostname = "";
                  try { hostname = new URL(href).hostname.replace(/^www\./, ""); } catch {}
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={href}
                      className="mx-0.5 inline-flex items-center align-middle rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/50 no-underline transition-colors hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white/70"
                    >
                      {hostname || childText}
                    </a>
                  );
                }
              }
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
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

/* -------------------------------------------------------------------------- */
/*  Code bubble                                                                */
/* -------------------------------------------------------------------------- */

function CodeBubble({ lang, code }: { lang: string | null; code: string }) {
  const isSingleLine = !code.includes("\n") && code.trim().length <= 80;
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (await copyToClipboard(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (lang === "mermaid") {
    return <MermaidDiagram code={code} />;
  }

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
