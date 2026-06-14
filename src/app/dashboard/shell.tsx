"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Brain,
  CheckCircle2,
  CornerDownLeft,
  ExternalLink,
  FileText,
  HelpCircle,
  Home,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Server,
  Settings,
  Terminal,
  Trash2,
  Waypoints,
  X,
  XCircle,
} from "lucide-react";
import type { ChatConversationSummary, ChatMode, ToolId } from "./data";
import type { GeneratedImageRow } from "@/lib/server/image-service";
import type { GenerateArgs } from "./image/workspace";
import { ImageWorkspace } from "./image/workspace";

import { SETTINGS_TOOL, TOOLS } from "./data";
import type { Tool } from "./data";
import {
  AiOverview,
  ChatLanding,
  ChatView,
  PlaceholderView,
  VpsView,
  stashPendingFirstMessage,
  type AttachmentPayload,
} from "./views";
import { GalleryView } from "./chat/gallery";
import { MemoryView } from "./chat/memory";
import { ArchivedView } from "./chat/archived";
import { CustomCommandsView } from "./chat/custom-commands";
import { SystemPromptsView } from "./chat/system-prompts";
import { UsageView } from "./chat/usage";
import { Logo } from "@/components/ui/Logo";
import { vpsApi, type VpsInstance as ApiVpsInstance } from "@/lib/client/vps-api";
import { normalizeStatus, toUiInstance } from "@/lib/client/vps-mappers";

/**
 * Module-level constant so an `instances={undefined}` prop doesn't allocate a
 * fresh array on every render and invalidate the `useMemo` below.
 */
const NO_INSTANCES: readonly ApiVpsInstance[] = [];

/* -------------------------------------------------------------------------- */
/*  Sub-sidebar sections                                                      */
/* -------------------------------------------------------------------------- */

type SubItem = {
  id: string;
  label: string;
  external?: boolean;
  status?: string;
  href?: string;
  /** When true, a spinner is shown to indicate a background streaming process. */
  streaming?: boolean;
  /** When set, a ⋯ menu appears with a Delete action. */
  onDelete?: () => void;
  deleteLabel?: string;
  /** When set, the ⋯ menu gains a Rename action with inline editing. */
  onRename?: (newLabel: string) => void;
  /** When set, the ⋯ menu gains a Pin/Unpin action. `pinned` drives the label. */
  onPin?: () => void;
  pinned?: boolean;
  /** When set, the ⋯ menu gains an Archive/Unarchive action. */
  onArchive?: () => void;
  archived?: boolean;
  /** When true, this item participates in drag-to-reorder within its section. */
  draggable?: boolean;
};
type SubSection = {
  title: string;
  items: SubItem[];
  /** When true and items is empty, renders the search-aware "No matches" state. */
  searchable?: boolean;
  /** Called with the new ordered ids when the user reorders draggable items. */
  onReorder?: (orderedIds: string[]) => void;
  /** When true, the section grows to fill available space and scrolls internally. */
  scrollable?: boolean;
};

type AppToast = {
  id: string;
  type: "success" | "error";
  message: string;
};

function truncatePrompt(prompt: string, max = 45): string {
  return prompt.length > max ? prompt.slice(0, max) + "…" : prompt;
}

function buildSections(
  toolId: ToolId,
  chatConversations: ChatConversationSummary[],
  vpsInstances: readonly ApiVpsInstance[],
  images: GeneratedImageRow[],
  onDeleteConversation?: (id: string) => void,
  onRenameConversation?: (id: string, title: string) => void,
  onReorderVps?: (orderedIds: string[]) => void,
  streamingConversationIds?: Set<string>,
  showAdminNav = false,
  onPinConversation?: (id: string) => void,
  onArchiveConversation?: (id: string) => void,
): SubSection[] {
  if (toolId === "settings") {
    const sections: SubSection[] = [
      {
        title: "Account",
        items: [
          { id: "settings:account", label: "Profile", href: "/dashboard/settings/account" },
        ],
      },
      {
        title: "Security",
        items: [
          { id: "settings:security", label: "Password & Sessions", href: "/dashboard/settings/security" },
        ],
      },
      {
        title: "Danger zone",
        items: [
          { id: "settings:danger", label: "Delete account", href: "/dashboard/settings/danger" },
        ],
      },
    ];

    if (showAdminNav) {
      sections.push({
        title: "Admin",
        items: [
          { id: "admin:og", label: "OG Images", href: "/dashboard/admin/og" },
        ],
      });
    }

    return sections;
  }
  if (toolId === "vps") {
    return [
      {
        title: "Instances",
        onReorder: onReorderVps,
        items: vpsInstances.map((i) => ({
          id: i.id,
          label: i.name,
          status: normalizeStatus(i.provider_status ?? i.status),
          // Navigating to the index route ensures clicking an instance from a
          // sub-route (BYOK/Terminal) actually switches to its detail view —
          // the onClick alone only updates state the sub-route doesn't render.
          href: `/dashboard/vps?instance=${i.id}`,
          draggable: Boolean(onReorderVps),
        })),
      },
      {
        title: "Platform",
        items: [
          { id: "vps:byok", label: "BYOK", href: "/dashboard/vps/byok" },
          { id: "vps:terminal", label: "Terminal", href: "/dashboard/vps/terminal" },
        ],
      },
    ];
  }
  if (toolId === "ai") {
    return [
      {
        title: "Settings",
        items: [
          { id: "ai:usage",   label: "Usage",   href: "/dashboard/ai/usage" },
          { id: "ai:keys",    label: "Keys",    href: "/dashboard/ai/keys" },
          { id: "ai:billing", label: "Billing", href: "/dashboard/ai/billing" },
        ],
      },
      {
        title: "Reference",
        items: [{ id: "ai:models", label: "Models", href: "/dashboard/ai/models" }],
      },
    ];
  }
  if (toolId === "image") {
    return [
      {
        title: "Generations",
        searchable: true,
        items: images.map((img) => ({
          id: img.id,
          label: truncatePrompt(img.prompt),
          // Pending (in-flight) generations show a spinner; derived from the
          // DB row status so it survives reloads and cross-tool navigation.
          streaming: img.status === "pending",
        })),
      },
    ];
  }
  const toConversationItem = (c: ChatConversationSummary): SubItem => ({
    id: c.id,
    label: c.title,
    streaming: streamingConversationIds?.has(c.id) ?? false,
    onDelete: onDeleteConversation ? () => onDeleteConversation(c.id) : undefined,
    deleteLabel: "Delete conversation",
    onRename: onRenameConversation
      ? (newTitle: string) => onRenameConversation(c.id, newTitle)
      : undefined,
    onPin: onPinConversation ? () => onPinConversation(c.id) : undefined,
    pinned: c.pinned ?? false,
    onArchive: onArchiveConversation ? () => onArchiveConversation(c.id) : undefined,
    archived: c.archived_at != null,
  });

  const pinned = chatConversations.filter((c) => c.pinned);
  const unpinned = chatConversations.filter((c) => !c.pinned);

  const conversationSections: SubSection[] = [];
  if (pinned.length > 0) {
    conversationSections.push({
      title: "Pinned",
      searchable: true,
      items: pinned.map(toConversationItem),
    });
  }
  conversationSections.push({
    title: "Conversations",
    searchable: true,
    scrollable: true,
    items: unpinned.map(toConversationItem),
  });

  return [
    ...conversationSections,
    {
      title: "Configuration",
      items: [
        { id: "chat:prompts", label: "System Prompts" },
        { id: "chat:commands", label: "Slash Commands" },
        { id: "chat:gallery", label: "Gallery" },
        { id: "chat:memory", label: "Memory" },
        { id: "chat:archived", label: "Archived" },
      ],
    },
    {
      title: "Platform",
      items: [{ id: "chat:usage", label: "Usage" }],
    },
  ];
}

const PLACEHOLDER_LABELS: Record<string, { title: string; description: string }> = {
  "ai:fallbacks": { title: "Fallbacks", description: "Per-route fallback chain when the primary model fails." },
};

/**
 * Chat config items that have their own static route under /dashboard/chat/*.
 * These reserved URL segments take precedence over the [id] dynamic route, so
 * selecting them navigates rather than holding selection in local state.
 * Conversation ids are UUIDs, so they never collide with these words.
 */
const CHAT_SEGMENT_TO_ITEM: Record<string, string> = {
  "system-prompts": "chat:prompts",
  commands: "chat:commands",
  memory: "chat:memory",
  gallery: "chat:gallery",
  usage: "chat:usage",
  archived: "chat:archived",
};
const CHAT_ITEM_TO_SEGMENT: Record<string, string> = Object.fromEntries(
  Object.entries(CHAT_SEGMENT_TO_ITEM).map(([seg, id]) => [id, seg]),
);

/* -------------------------------------------------------------------------- */
/*  Shell                                                                     */
/* -------------------------------------------------------------------------- */

export function DashboardShell({
  toolId,
  children,
  chatConversations: initialChatConversations,
  defaultChatModel,
  instances,
  initialImages: initialImagesProp,
  initialActiveId,
  showAdminNav = false,
}: {
  toolId: ToolId;
  children?: React.ReactNode;
  chatConversations?: ChatConversationSummary[];
  defaultChatModel?: string;
  /** Real instance rows for the VPS tool. Ignored for other tools. */
  instances?: ApiVpsInstance[];
  /** Generated images for the Image Studio tool. Ignored for other tools. */
  initialImages?: GeneratedImageRow[];
  /** Pre-selected sub-sidebar item id (e.g. from `?instance=<id>`). */
  initialActiveId?: string;
  /** Shows owner-only admin navigation entries in the settings sidebar. */
  showAdminNav?: boolean;
}) {
  const [chatConversations, setChatConversations] = useState<
    ChatConversationSummary[]
  >(initialChatConversations ?? []);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [imageSearch, setImageSearch] = useState("");

  const [images, setImages] = useState<GeneratedImageRow[]>(
    initialImagesProp ?? [],
  );
  // Re-sync prop → state when the server re-fetches (same pattern as VPS).
  const [lastImagesProp, setLastImagesProp] = useState(initialImagesProp);
  if (initialImagesProp !== lastImagesProp) {
    setLastImagesProp(initialImagesProp);
    setImages(initialImagesProp ?? []);
  }

  // Pending generations are server-side jobs persisted as rows with
  // status='pending'. They live in `images`, so they survive reload and
  // cross-tool navigation. We poll while any pending row exists.
  const hasPendingImage = useMemo(
    () => images.some((img) => img.status === "pending"),
    [images],
  );

  // Toast notifications
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const addToast = useCallback((t: Omit<AppToast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);

  const [vpsInstancesState, setVpsInstancesState] = useState<readonly ApiVpsInstance[]>(
    instances ?? NO_INSTANCES,
  );
  // Re-sync with the prop when the parent passes a new array (e.g. after
  // `router.refresh()`), without an effect. Using the documented
  // "adjusting state during render" pattern so an in-flight optimistic reorder
  // isn't clobbered by an extra render.
  const [lastInstancesProp, setLastInstancesProp] = useState(instances);
  if (instances !== lastInstancesProp) {
    setLastInstancesProp(instances);
    setVpsInstancesState(instances ?? NO_INSTANCES);
  }
  const vpsInstances: readonly ApiVpsInstance[] = vpsInstancesState;

  const [activeItems, setActiveItems] = useState<Record<ToolId, string>>(() => ({
    vps:
      toolId === "vps"
        ? initialActiveId ?? vpsInstances[0]?.id ?? ""
        : vpsInstances[0]?.id ?? "",
    ai: "ai:usage",
    chat: chatConversations[0]?.id ?? "",
    image: "",
    settings: initialActiveId ?? "settings:account",
  }));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl+K toggles the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Tracks which conversation IDs have a streaming response in-flight so the
  // sub-sidebar can show a spinner even after the user navigates away.
  const [streamingConversationIds, setStreamingConversationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const handleStreamingChange = useCallback((conversationId: string, streaming: boolean) => {
    setStreamingConversationIds((prev) => {
      const next = new Set(prev);
      if (streaming) {
        next.add(conversationId);
      } else {
        next.delete(conversationId);
      }
      return next;
    });
  }, []);

  const tool = useMemo(
    () =>
      toolId === "settings"
        ? SETTINGS_TOOL
        : TOOLS.find((t) => t.id === toolId) ?? TOOLS[0],
    [toolId],
  );

  const setItem = useCallback((id: string) => {
    setActiveItems((prev) => ({ ...prev, [toolId]: id }));
  }, [toolId]);

  const router = useRouter();

  // ── Route-based chat selection ────────────────────────────────────────────
  // The active conversation lives in the URL: /dashboard/chat/[id]. The layout
  // segment is the conversation id, a reserved config word (system-prompts /
  // memory / gallery / usage), or null on the bare /dashboard/chat landing.
  // Routed config items resolve straight from the URL; the chatConfigItem
  // local state remains as a fallback for any item without its own route.
  const chatSegment = useSelectedLayoutSegment();
  const routedConfigItem = chatSegment ? CHAT_SEGMENT_TO_ITEM[chatSegment] : undefined;
  // A real conversation id is any segment that isn't one of the reserved words.
  const conversationSegment =
    chatSegment && !routedConfigItem ? chatSegment : null;
  const [chatConfigItem, setChatConfigItem] = useState("");
  // When the URL changes, drop any stale local config selection so it doesn't
  // shadow a conversation or routed config view.
  const [lastChatSegment, setLastChatSegment] = useState(chatSegment);
  if (chatSegment !== lastChatSegment) {
    setLastChatSegment(chatSegment);
    if (chatSegment !== null && chatConfigItem) setChatConfigItem("");
  }
  const activeChatId = routedConfigItem ?? conversationSegment ?? chatConfigItem;
  // Effective active sub-sidebar item for the current tool. Chat is URL-driven;
  // every other tool still reads from local `activeItems` state.
  const activeItemId = toolId === "chat" ? activeChatId : activeItems[toolId];

  const handleSelectItem = useCallback(
    (id: string) => {
      if (toolId === "chat") {
        const segment = CHAT_ITEM_TO_SEGMENT[id];
        if (segment) {
          // Routed config item — navigate to its own URL.
          setChatConfigItem("");
          router.push(`/dashboard/chat/${segment}`);
        } else if (id.startsWith("chat:")) {
          // Config item without its own route — held in local state.
          setChatConfigItem(id);
          if (chatSegment !== null) router.push("/dashboard/chat");
        } else {
          setChatConfigItem("");
          router.push(`/dashboard/chat/${id}`);
        }
        return;
      }
      setItem(id);
    },
    [toolId, chatSegment, router, setItem],
  );

  const handleReorderVps = useCallback(
    async (orderedIds: string[]) => {
      const prev = vpsInstancesState;
      const byId = new Map(prev.map((i) => [i.id, i]));
      const reordered: ApiVpsInstance[] = [];
      for (const id of orderedIds) {
        const inst = byId.get(id);
        if (inst) reordered.push(inst);
      }
      // Append any items the caller forgot — defensive but expected to be a no-op.
      for (const inst of prev) {
        if (!orderedIds.includes(inst.id)) reordered.push(inst);
      }
      setVpsInstancesState(reordered);
      try {
        await vpsApi.reorderInstances(reordered.map((i) => i.id));
      } catch {
        setVpsInstancesState(prev);
      }
    },
    [vpsInstancesState],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      // Optimistic remove. If the request fails we restore the prior list so
      // the user doesn't lose the conversation visually.
      const prevList = chatConversations;
      const remaining = prevList.filter((c) => c.id !== id);
      setChatConversations(remaining);
      // If the deleted conversation is the one open in the URL, go to the
      // new-chat landing rather than auto-opening another conversation — the
      // user closed this thread, so don't silently surface an unrelated one.
      if (chatSegment === id) {
        router.push("/dashboard/chat");
      }
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) {
          setChatConversations(prevList);
        }
      } catch {
        setChatConversations(prevList);
      }
    },
    [chatConversations, chatSegment, router],
  );

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      // Optimistic update
      setChatConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
      );
      try {
        await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });
      } catch {
        // ignore — the optimistic update stays; a full refresh will correct it
      }
    },
    [],
  );

  const handlePinConversation = useCallback(
    async (id: string) => {
      // Optimistic toggle. buildSections re-buckets pinned items into their own
      // section, so flipping the flag here moves the row immediately.
      let nextPinned = false;
      setChatConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          nextPinned = !c.pinned;
          return { ...c, pinned: nextPinned };
        }),
      );
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: nextPinned }),
        });
        if (!res.ok) {
          setChatConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, pinned: !nextPinned } : c)),
          );
        }
      } catch {
        setChatConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, pinned: !nextPinned } : c)),
        );
      }
    },
    [],
  );

  const handleArchiveConversation = useCallback(
    async (id: string) => {
      // Archiving removes the row from the active list (listConversations
      // filters archived out). Optimistically drop it, restore on failure.
      const prevList = chatConversations;
      setChatConversations(prevList.filter((c) => c.id !== id));
      if (chatSegment === id) {
        router.push("/dashboard/chat");
      }
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        });
        if (!res.ok) setChatConversations(prevList);
      } catch {
        setChatConversations(prevList);
      }
    },
    [chatConversations, chatSegment, router],
  );

  const filteredChatConversations = useMemo(() => {
    if (toolId !== "chat") return chatConversations;
    const q = chatSearch.trim().toLowerCase();
    if (!q) return chatConversations;
    return chatConversations.filter((c) =>
      c.title.toLowerCase().includes(q),
    );
  }, [chatConversations, chatSearch, toolId]);

  const filteredImages = useMemo(() => {
    if (toolId !== "image") return images;
    const q = imageSearch.trim().toLowerCase();
    if (!q) return images;
    return images.filter((img) => img.prompt.toLowerCase().includes(q));
  }, [images, imageSearch, toolId]);

  const sections = useMemo(
    () =>
      buildSections(
        toolId,
        filteredChatConversations,
        vpsInstances,
        filteredImages,
        toolId === "chat" ? handleDeleteConversation : undefined,
        toolId === "chat" ? handleRenameConversation : undefined,
        toolId === "vps" ? handleReorderVps : undefined,
        toolId === "chat" ? streamingConversationIds : undefined,
        showAdminNav,
        toolId === "chat" ? handlePinConversation : undefined,
        toolId === "chat" ? handleArchiveConversation : undefined,
      ),
    [
      toolId,
      filteredChatConversations,
      vpsInstances,
      filteredImages,
      handleDeleteConversation,
      handleRenameConversation,
      handleReorderVps,
      streamingConversationIds,
      showAdminNav,
      handlePinConversation,
      handleArchiveConversation,
    ],
  );

  // The "new conversation" (+) button just opens the landing composer. No row
  // is created here — deferred creation means the conversation is only POSTed
  // on first send (handleStartChat), so clicking + repeatedly can never leave
  // empty "New conversation" rows in the list.
  const handleCreateConversation = useCallback(() => {
    setChatConfigItem("");
    router.push("/dashboard/chat");
  }, [router]);

  // Deferred creation: the landing composer calls this with the first message
  // plus the chosen model and mode. We create the conversation with those
  // settings, stash the text keyed by its new id, then navigate to
  // /dashboard/chat/[id] where the mounted ChatView auto-sends it. This avoids
  // ever creating an empty conversation row from just opening chat.
  const handleStartChat = useCallback(
    async (
      text: string,
      opts: { model: string; mode: ChatMode; attachments?: AttachmentPayload[]; systemPromptId?: string | null },
    ) => {
      if (creatingConversation) return;
      setCreatingConversation(true);
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: opts.model,
            mode: opts.mode,
            ...(opts.systemPromptId ? { system_prompt_id: opts.systemPromptId } : {}),
          }),
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          conversation: ChatConversationSummary;
        };
        setChatConversations((prev) => [data.conversation, ...prev]);
        setChatConfigItem("");
        stashPendingFirstMessage(
          data.conversation.id,
          text,
          opts.attachments ?? [],
        );
        router.push(`/dashboard/chat/${data.conversation.id}`);
      } finally {
        setCreatingConversation(false);
      }
    },
    [creatingConversation, router],
  );

  const handleConversationUpdated = useCallback(
    (updated: ChatConversationSummary) => {
      setChatConversations((prev) => {
        const next = prev.filter((c) => c.id !== updated.id);
        return [updated, ...next];
      });
    },
    [],
  );

  const handleNewGeneration = useCallback(() => {
    setActiveItems((prev) => ({ ...prev, image: "" }));
  }, []);

  const handleStartGeneration = useCallback(
    async ({
      prompt,
      negativePrompt,
      aspect,
      quality,
      imageUrls,
      background,
      maskUrl,
    }: GenerateArgs) => {
      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            negative_prompt: negativePrompt,
            aspect_ratio: aspect,
            quality,
            image_urls: imageUrls,
            background,
            mask_url: maskUrl,
            source: "workspace",
          }),
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as {
            error?: string | { message?: string; code?: string };
          };
          const errMsg =
            typeof json.error === "string"
              ? json.error
              : typeof json.error?.message === "string"
                ? json.error.message
                : `HTTP ${res.status}`;
          throw new Error(errMsg);
        }

        // 202: the server inserted a pending row and is generating in the
        // background. Add the pending row to state and navigate to it; polling
        // flips it to completed/failed.
        const data = (await res.json()) as { image: GeneratedImageRow };
        setImages((prev) => [data.image, ...prev]);
        setActiveItems((prev) => ({ ...prev, image: data.image.id }));
      } catch (err) {
        addToast({
          type: "error",
          message: err instanceof Error ? err.message : "Generation failed",
        });
      }
    },
    [addToast],
  );

  // Poll for in-flight jobs. While any pending row exists, re-fetch the list
  // every 3s and reconcile. Surfaces completion/failure even after a reload or
  // navigating between tools.
  useEffect(() => {
    if (!hasPendingImage) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/images?limit=60");
        if (!res.ok) return;
        const data = (await res.json()) as { images: GeneratedImageRow[] };
        if (cancelled) return;
        const fetched = data.images;
        const prevById = new Map(images.map((img) => [img.id, img]));
        for (const img of fetched) {
          const before = prevById.get(img.id);
          if (before?.status === "pending" && img.status === "completed") {
            addToast({ type: "success", message: "Image generated successfully" });
          } else if (before?.status === "pending" && img.status === "failed") {
            addToast({
              type: "error",
              message: img.error || "Generation failed",
            });
          }
        }
        setImages(fetched);
      } catch {
        // transient — try again next tick
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hasPendingImage, images, addToast]);

  const handleDeleteImage = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/images?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        setImages((prev) => prev.filter((img) => img.id !== id));
        setActiveItems((prev) => ({
          ...prev,
          image: prev.image === id ? "" : prev.image,
        }));
        addToast({ type: "success", message: "Image deleted" });
      } catch (err) {
        addToast({
          type: "error",
          message: err instanceof Error ? err.message : "Delete failed",
        });
      }
    },
    [addToast],
  );

  const onCreate =
    toolId === "chat"
      ? handleCreateConversation
      : toolId === "image"
        ? handleNewGeneration
        : undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <TopBar
        tool={tool}
        onMenuOpen={() => setDrawerOpen(true)}
        onSearchOpen={() => setPaletteOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Primary sidebar (icon rail) — desktop only */}
        <PrimarySidebar activeTool={toolId} />

        {/* Sub-sidebar — desktop only */}
        <SubSidebar
          tool={tool}
          sections={sections}
          activeItem={activeItemId}
          onSelectItem={handleSelectItem}
          onCreate={onCreate}
          search={
            toolId === "chat"
              ? chatSearch
              : toolId === "image"
                ? imageSearch
                : undefined
          }
          onSearchChange={
            toolId === "chat"
              ? setChatSearch
              : toolId === "image"
                ? setImageSearch
                : undefined
          }
          searchPlaceholder={
            toolId === "chat"
              ? "Search conversations…"
              : toolId === "image"
                ? "Search generations…"
                : undefined
          }
        />

        {/* Main working surface */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#1c1c1c]">
          {(() => {
            const main = renderMain({
              activeTool: toolId,
              activeItemId,
              chatConversations,
              defaultChatModel,
              onStartChat: handleStartChat,
              creatingConversation,
              onConversationUpdated: handleConversationUpdated,
              onStreamingChange: handleStreamingChange,
              onDeleteConversation: handleDeleteConversation,
              vpsInstances,
              images,
              onGenerate: handleStartGeneration,
              onDeleteImage: handleDeleteImage,
            });
            // Chat content is fully URL-segment-driven through renderMain (its
            // page files render nothing), so ignore `children` for chat. Other
            // tools render server page content via `children` when present.
            return toolId === "chat" ? main : (children ?? main);
          })()}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <MobileDrawer
          tool={tool}
          sections={sections}
          activeTool={toolId}
          activeItem={activeItemId}
          onSelectItem={(id) => {
            handleSelectItem(id);
            setDrawerOpen(false);
          }}
          onClose={() => setDrawerOpen(false)}
          onCreate={
            onCreate
              ? () => {
                  onCreate();
                  setDrawerOpen(false);
                }
              : undefined
          }
          search={
            toolId === "chat"
              ? chatSearch
              : toolId === "image"
                ? imageSearch
                : undefined
          }
          onSearchChange={
            toolId === "chat"
              ? setChatSearch
              : toolId === "image"
                ? setImageSearch
                : undefined
          }
          searchPlaceholder={
            toolId === "chat"
              ? "Search conversations…"
              : toolId === "image"
                ? "Search generations…"
                : undefined
          }
        />
      ) : null}

      {paletteOpen ? (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          chatConversations={chatConversations}
          onCreateConversation={handleCreateConversation}
          onNewGeneration={handleNewGeneration}
        />
      ) : null}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Command palette (⌘K) — cross-tool search + navigation                     */
/* -------------------------------------------------------------------------- */

type PaletteGroup =
  | "Actions"
  | "Navigate"
  | "Conversations"
  | "System prompts"
  | "Memory"
  | "Images";

type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;
  sublabel?: string;
  icon: typeof Search;
  /** Extra terms folded into the match (model names, tags, etc.). */
  keywords?: string;
  run: () => void;
};

// Order groups appear in the results list.
const PALETTE_GROUP_ORDER: PaletteGroup[] = [
  "Actions",
  "Navigate",
  "Conversations",
  "System prompts",
  "Memory",
  "Images",
];

type PaletteEntity = { id: string; label: string; sublabel?: string };

function CommandPalette({
  onClose,
  chatConversations,
  onCreateConversation,
  onNewGeneration,
}: {
  onClose: () => void;
  chatConversations: ChatConversationSummary[];
  onCreateConversation: () => void;
  onNewGeneration: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // Tracks the user's keyboard/hover hover intent. The effective active row is
  // derived during render by clamping this against the current result count, so
  // a shrinking list never needs a state-syncing effect.
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Lazily-fetched entities that aren't in the shell's client state. Fetched
  // once when the palette opens; the component unmounts on close.
  const [prompts, setPrompts] = useState<PaletteEntity[] | null>(null);
  const [memories, setMemories] = useState<PaletteEntity[] | null>(null);
  const [images, setImages] = useState<PaletteEntity[] | null>(null);

  // Focus the input on mount via a ref callback (no setState-in-effect).
  const focusInput = useCallback((el: HTMLInputElement | null) => {
    el?.focus();
  }, []);

  // One-shot fetch of cross-tool entities not already in memory.
  useEffect(() => {
    let cancelled = false;
    const get = async <T,>(url: string, pick: (json: unknown) => T) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return pick(await res.json());
      } catch {
        return null;
      }
    };
    get("/api/system-prompts", (j) => {
      const list = (j as { prompts?: { id: string; name: string }[] }).prompts ?? [];
      return list.map((p) => ({ id: p.id, label: p.name }));
    }).then((v) => {
      if (!cancelled && v) setPrompts(v);
    });
    get("/api/memory", (j) => {
      const list = (j as { memories?: { id: string; content: string }[] }).memories ?? [];
      return list.map((m) => ({ id: m.id, label: m.content }));
    }).then((v) => {
      if (!cancelled && v) setMemories(v);
    });
    get("/api/images?limit=120", (j) => {
      const list = (j as { images?: { id: string; prompt: string; model: string }[] }).images ?? [];
      return list.map((img) => ({ id: img.id, label: img.prompt, sublabel: img.model }));
    }).then((v) => {
      if (!cancelled && v) setImages(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const go = useCallback(
    (run: () => void) => {
      onClose();
      run();
    },
    [onClose],
  );

  // The full candidate list, independent of the query.
  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];

    // Actions
    out.push({
      id: "action:new-conversation",
      group: "Actions",
      label: "New conversation",
      icon: Plus,
      keywords: "chat create start",
      run: onCreateConversation,
    });
    out.push({
      id: "action:new-generation",
      group: "Actions",
      label: "New image generation",
      icon: ImagePlus,
      keywords: "image create generate",
      run: onNewGeneration,
    });

    // Navigation — tools and their sub-views (all real routes).
    const nav: { label: string; href: string; icon: typeof Search; keywords?: string }[] = [
      { label: "Chat AI", href: "/dashboard/chat", icon: MessageSquare, keywords: "assistant conversation" },
      { label: "VPS Control", href: "/dashboard/vps", icon: Server, keywords: "infrastructure server instance" },
      { label: "AI Router", href: "/dashboard/ai", icon: Waypoints, keywords: "models routes" },
      { label: "Image Studio", href: "/dashboard/image", icon: ImagePlus, keywords: "media generate" },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, keywords: "account preferences" },
      { label: "System prompts", href: "/dashboard/chat/system-prompts", icon: FileText, keywords: "chat instructions" },
      { label: "Memory", href: "/dashboard/chat/memory", icon: Brain, keywords: "chat facts" },
      { label: "Gallery", href: "/dashboard/chat/gallery", icon: ImageIcon, keywords: "chat images" },
      { label: "Chat usage", href: "/dashboard/chat/usage", icon: BarChart3, keywords: "tokens cost" },
      { label: "AI usage", href: "/dashboard/ai/usage", icon: BarChart3, keywords: "router metrics" },
      { label: "API keys", href: "/dashboard/ai/keys", icon: Waypoints, keywords: "router byok" },
      { label: "AI billing", href: "/dashboard/ai/billing", icon: BarChart3, keywords: "router cost" },
      { label: "AI models", href: "/dashboard/ai/models", icon: Waypoints, keywords: "router catalogue" },
      { label: "VPS terminal", href: "/dashboard/vps/terminal", icon: Terminal, keywords: "ssh console" },
      { label: "Account", href: "/dashboard/settings/account", icon: Settings },
      { label: "Security", href: "/dashboard/settings/security", icon: Settings },
    ];
    for (const n of nav) {
      out.push({
        id: `nav:${n.href}`,
        group: "Navigate",
        label: n.label,
        sublabel: n.href,
        icon: n.icon,
        keywords: n.keywords,
        run: () => router.push(n.href),
      });
    }

    // Conversations — already in the shell's client state.
    for (const c of chatConversations) {
      out.push({
        id: `conv:${c.id}`,
        group: "Conversations",
        label: c.title || "Untitled conversation",
        sublabel: c.model,
        icon: MessageSquare,
        run: () => router.push(`/dashboard/chat/${c.id}`),
      });
    }

    // System prompts — lazily fetched.
    for (const p of prompts ?? []) {
      out.push({
        id: `prompt:${p.id}`,
        group: "System prompts",
        label: p.label,
        icon: FileText,
        run: () => router.push("/dashboard/chat/system-prompts"),
      });
    }

    // Memory facts — lazily fetched.
    for (const m of memories ?? []) {
      out.push({
        id: `mem:${m.id}`,
        group: "Memory",
        label: m.label,
        icon: Brain,
        run: () => router.push("/dashboard/chat/memory"),
      });
    }

    // Generated images — lazily fetched.
    for (const img of images ?? []) {
      out.push({
        id: `img:${img.id}`,
        group: "Images",
        label: img.label || "Untitled generation",
        sublabel: img.sublabel,
        icon: ImageIcon,
        run: () => router.push("/dashboard/chat/gallery"),
      });
    }

    return out;
  }, [chatConversations, prompts, memories, images, router, onCreateConversation, onNewGeneration]);

  // Filter + cap per group so one entity type can't crowd out the rest.
  const filtered = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? items.filter((it) =>
          `${it.label} ${it.sublabel ?? ""} ${it.keywords ?? ""}`
            .toLowerCase()
            .includes(q),
        )
      : items;
    const perGroup = q ? 6 : 4;
    const counts: Partial<Record<PaletteGroup, number>> = {};
    const capped: PaletteItem[] = [];
    for (const group of PALETTE_GROUP_ORDER) {
      for (const it of matches) {
        if (it.group !== group) continue;
        const n = counts[group] ?? 0;
        if (n >= perGroup) continue;
        counts[group] = n + 1;
        capped.push(it);
      }
    }
    return capped;
  }, [items, query]);

  // Effective row, clamped during render so a shrinking list never points past
  // the end (avoids a state-syncing effect).
  const activeRow = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  // Keep the active row scrolled into view. No setState — safe inside an effect.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeRow}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeRow]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeRow];
      if (item) go(item.run);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let renderedGroup: PaletteGroup | null = null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-white/[0.1] bg-[#161616] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-3">
          <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
          <input
            ref={focusInput}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search conversations, tools, memory…"
            className="h-12 w-full bg-transparent text-[14px] text-white placeholder:text-white/35 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/40 sm:inline-block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-white/40">
              No matches for “{query}”.
            </p>
          ) : (
            filtered.map((item, idx) => {
              const showHeader = item.group !== renderedGroup;
              renderedGroup = item.group;
              const active = idx === activeRow;
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {showHeader ? (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white/35">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    data-idx={idx}
                    onClick={() => go(item.run)}
                    onMouseMove={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors ${
                      active ? "bg-white/[0.07] text-white" : "text-white/70"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.sublabel ? (
                      <span className="shrink-0 truncate font-mono text-[11px] text-white/35">
                        {item.sublabel}
                      </span>
                    ) : null}
                    {active ? (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden />
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/*  Toast (portal — rendered into document.body to escape overflow/stacking) */
/* -------------------------------------------------------------------------- */

function ToastContainer({ toasts }: { toasts: AppToast[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-5 right-5 z-[9999] flex flex-col gap-2"
      style={{ maxWidth: "calc(100vw - 2.5rem)" }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex min-w-[260px] items-start gap-3 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-2xl ${
            toast.type === "success"
              ? "border-[#3ecf8e]/40 bg-[#0f1f18] text-[#3ecf8e]"
              : "border-red-500/40 bg-[#1f0f0f] text-red-300"
          }`}
        >
          <span className="mt-px shrink-0">
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4" aria-hidden />
            )}
          </span>
          <span className="leading-snug">{toast.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/*  Main content router                                                       */
/* -------------------------------------------------------------------------- */

function renderMain({
  activeTool,
  activeItemId,
  chatConversations,
  defaultChatModel,
  onStartChat,
  creatingConversation,
  onConversationUpdated,
  onStreamingChange,
  onDeleteConversation,
  vpsInstances,
  images,
  onGenerate,
  onDeleteImage,
}: {
  activeTool: ToolId;
  activeItemId: string;
  chatConversations: ChatConversationSummary[];
  defaultChatModel?: string;
  onStartChat: (
    text: string,
    opts: { model: string; mode: ChatMode; attachments?: AttachmentPayload[] },
  ) => void;
  creatingConversation: boolean;
  onConversationUpdated: (c: ChatConversationSummary) => void;
  onStreamingChange?: (conversationId: string, streaming: boolean) => void;
  onDeleteConversation?: (id: string) => void;
  vpsInstances: readonly ApiVpsInstance[];
  images: GeneratedImageRow[];
  onGenerate: (args: GenerateArgs) => void;
  onDeleteImage: (id: string) => void;
}): React.ReactNode {
  if (activeItemId === "chat:gallery" && activeTool === "chat") {
    return <GalleryView />;
  }

  if (activeItemId === "chat:memory" && activeTool === "chat") {
    return <MemoryView />;
  }

  if (activeItemId === "chat:archived" && activeTool === "chat") {
    return <ArchivedView />;
  }

  if (activeItemId === "chat:prompts" && activeTool === "chat") {
    return <SystemPromptsView />;
  }

  if (activeItemId === "chat:commands" && activeTool === "chat") {
    return <CustomCommandsView />;
  }

  if (activeItemId === "chat:usage" && activeTool === "chat") {
    return <UsageView />;
  }

  // Configuration / Platform pages use prefixed IDs (e.g. "vps:ssh-keys")
  if (activeItemId && activeItemId.includes(":")) {
    const meta = PLACEHOLDER_LABELS[activeItemId];
    return (
      <PlaceholderView
        title={meta?.title ?? "Coming soon"}
        description={
          meta?.description ?? "This page hasn't been built yet."
        }
      />
    );
  }

  if (activeTool === "image") {
    const activeRow = images.find((img) => img.id === activeItemId);
    const isPending = activeRow?.status === "pending";
    return (
      <ImageWorkspace
        key={`${activeItemId || "new"}:${activeRow?.status ?? ""}`}
        initialImages={images}
        selectedImageId={!isPending ? (activeItemId || undefined) : undefined}
        isPending={isPending}
        pendingPrompt={activeRow?.prompt}
        pendingCreatedAt={activeRow?.created_at}
        onGenerate={onGenerate}
        onDeleteImage={onDeleteImage}
      />
    );
  }

  if (activeTool === "vps") {
    if (vpsInstances.length === 0) return <VpsEmptyState />;
    const apiInstance =
      vpsInstances.find((i) => i.id === activeItemId) ?? vpsInstances[0];
    // `key` remounts VpsView when the active instance changes, so the lifecycle
    // poller and tab state can never read stale data from a previous selection.
    return <VpsView key={apiInstance.id} instance={toUiInstance(apiInstance)} />;
  }
  if (activeTool === "ai") {
    return <AiOverview />;
  }

  // Bare /dashboard/chat (no conversation segment) → deferred-creation landing.
  if (!activeItemId) {
    return (
      <ChatLanding
        onStart={onStartChat}
        starting={creatingConversation}
        defaultModel={defaultChatModel}
      />
    );
  }
  // A conversation id is in the URL. Prefer the summary from the local list;
  // if it isn't there yet (just-created race / direct navigation), synthesize a
  // minimal one keyed to the URL id so ChatView mounts for the RIGHT id and
  // hydrates via its own GET — never silently fall back to another conversation.
  const conversation = chatConversations.find((c) => c.id === activeItemId) ?? {
    id: activeItemId,
    title: "New chat",
    model: defaultChatModel ?? "",
    mode: "chat" as const,
    updated_at: new Date().toISOString(),
  };
  return (
    <ChatView
      key={conversation.id}
      conversation={conversation}
      defaultModel={defaultChatModel}
      onConversationUpdated={onConversationUpdated}
      onStreamingChange={onStreamingChange}
      onDelete={onDeleteConversation}
    />
  );
}

function VpsEmptyState() {
  const [byokError, setByokError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = sessionStorage.getItem("vps:byok-last-error");
        if (stored) setByokError(stored);
      } catch {
        /* sessionStorage unavailable — ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
        <Server className="h-5 w-5 text-white/35" aria-hidden />
      </div>
      <div>
        <p className="text-[15px] font-medium text-white">No instances yet</p>
        <p className="mt-1 text-[13px] text-white/40">
          Connect your Tencent Cloud account to import your existing VPS instances.
        </p>
      </div>
      {byokError ? (
        <div className="flex max-w-md items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-left text-[12px] text-amber-300/85">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <span className="font-medium text-amber-200">Last connect failed:</span>{" "}
            <span className="text-amber-300/70">{byokError}</span>
          </span>
        </div>
      ) : null}
      <Link
        href="/dashboard/vps/byok"
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
      >
        <Plus className="h-3.5 w-3.5" />
        Connect via BYOK
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top bar                                                                   */
/* -------------------------------------------------------------------------- */

function TopBar({
  tool,
  onMenuOpen,
  onSearchOpen,
}: {
  tool: Tool;
  onMenuOpen: () => void;
  onSearchOpen: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0c0c0c] px-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuOpen}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>

        <Link
          href="/"
          className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium tracking-[-0.01em] text-white/85 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Logo className="h-4 w-4" />
          yoga
        </Link>

        <Crumb />

        <span className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-white/70">
          <tool.icon className="h-3.5 w-3.5 text-white/45" aria-hidden />
          <span className="truncate">{tool.name}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onSearchOpen}
          className="hidden h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] pr-1.5 pl-2.5 text-[12px] text-white/55 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/80 md:inline-flex"
        >
          <Search className="h-3 w-3" aria-hidden />
          <span>Search…</span>
          <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono text-[10px] text-white/40">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          aria-label="Search"
          onClick={onSearchOpen}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/5 hover:text-white md:hidden"
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          aria-label="Help"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
        </button>

        <AccountMenu />
      </div>
    </header>
  );
}

function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSignOut = () => {
    setOpen(false);
    startSignOut(async () => {
      await fetch("/auth/sign-out", { method: "POST" });
      router.refresh();
      router.push("/");
    });
  };

  return (
    <div ref={containerRef} className="relative ml-1">
      <button
        type="button"
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#3ecf8e] to-[#24b47e] font-mono text-[11px] font-medium text-[#171717] hover:opacity-90"
      >
        y
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-30 min-w-[160px] overflow-hidden rounded-md border border-white/[0.08] bg-[#171717] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Crumb() {
  return (
    <span aria-hidden className="px-1 text-white/25">
      /
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Primary sidebar (icon rail, no expand)                                    */
/* -------------------------------------------------------------------------- */

function PrimarySidebar({ activeTool }: { activeTool: ToolId }) {
  return (
    <div className="relative hidden w-12 shrink-0 sm:block">
      <aside className="group absolute inset-y-0 left-0 z-20 flex w-12 flex-col overflow-hidden border-r border-white/[0.08] bg-[#0f0f0f] py-2 transition-[width] duration-200 ease-out hover:w-[220px] hover:shadow-[8px_0_24px_rgba(0,0,0,0.35)]">
        <nav
          aria-label="Tools"
          className="flex flex-col gap-0.5 px-1.5"
        >
          <RailButton
            icon={<Home className="h-4 w-4" aria-hidden />}
            label="Home"
            href="/"
          />

          <Separator />

          {TOOLS.map((t) => (
            <RailButton
              key={t.id}
              icon={<t.icon className="h-4 w-4" aria-hidden />}
              label={t.name}
              active={t.id === activeTool}
              href={`/dashboard/${t.id}`}
            />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 px-1.5">
          <Separator />
          <RailButton
            icon={<Settings className="h-4 w-4" aria-hidden />}
            label="Settings"
            active={activeTool === "settings"}
            href="/dashboard/settings"
          />
        </div>
      </aside>
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="my-1 h-px w-full bg-white/[0.06]" />;
}

function RailButton({
  icon,
  label,
  active,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = `relative flex h-9 w-full items-center gap-2 rounded-md text-[13px] transition-colors ${
    active
      ? "bg-white/[0.06] text-white"
      : "text-white/55 hover:bg-white/[0.04] hover:text-white"
  }`;

  const inner = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {label}
      </span>
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[#3ecf8e]"
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        title={label}
        className={cls}
        onClick={onClick}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cls}
    >
      {inner}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-sidebar (sectioned navigation)                                        */
/* -------------------------------------------------------------------------- */

function SubSidebar({
  tool,
  sections,
  activeItem,
  onSelectItem,
  onCreate,
  search,
  onSearchChange,
  searchPlaceholder,
}: {
  tool: Tool;
  sections: SubSection[];
  activeItem: string;
  onSelectItem: (id: string) => void;
  onCreate?: () => void;
  search?: string;
  onSearchChange?: (next: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <aside className="hidden min-h-0 w-[200px] shrink-0 flex-col border-r border-white/[0.08] bg-[#171717] sm:flex md:w-[220px]">
      <SubSidebarHeader tool={tool} onCreate={onCreate} />
      {onSearchChange ? (
        <SubSidebarSearch
          value={search ?? ""}
          onChange={onSearchChange}
          placeholder={searchPlaceholder ?? "Search…"}
        />
      ) : null}
      <SubSidebarBody
        sections={sections}
        activeItem={activeItem}
        onSelectItem={onSelectItem}
        searching={Boolean(search && search.trim().length > 0)}
      />
    </aside>
  );
}

const TOOL_CREATE_HREF: Partial<Record<ToolId, string>> = {
  vps: "/dashboard/vps/byok",
  ai:  "/dashboard/ai/keys",
};

function SubSidebarHeader({
  tool,
  onCreate,
}: {
  tool: Tool;
  onCreate?: () => void;
}) {
  const createHref = TOOL_CREATE_HREF[tool.id];
  const showCreate = Boolean(tool.createLabel);
  const btnCls =
    "inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/70 transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/10 hover:text-[#3ecf8e] disabled:opacity-50 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.03] disabled:hover:text-white/70";

  return (
    <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
      <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
        {tool.name}
      </h2>
      {!showCreate ? null : createHref ? (
        <Link
          href={createHref}
          aria-label={tool.createLabel}
          title={tool.createLabel}
          className={btnCls}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : (
        <button
          type="button"
          onClick={onCreate}
          aria-label={tool.createLabel}
          title={tool.createLabel}
          className={btnCls}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </header>
  );
}

function SubSidebarBody({
  sections,
  activeItem,
  onSelectItem,
  searching,
}: {
  sections: SubSection[];
  activeItem: string;
  onSelectItem: (id: string) => void;
  searching?: boolean;
}) {
  return (
    <nav
      aria-label="Sub navigation"
      className="flex flex-1 flex-col overflow-hidden"
    >
      {sections.map((section) => (
        <SubSidebarSection
          key={section.title}
          section={section}
          activeItem={activeItem}
          onSelectItem={onSelectItem}
          searching={searching}
        />
      ))}
    </nav>
  );
}

function SubSidebarSection({
  section,
  activeItem,
  onSelectItem,
  searching,
}: {
  section: SubSection;
  activeItem: string;
  onSelectItem: (id: string) => void;
  searching?: boolean;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const reorderable = Boolean(section.onReorder);

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    if (!reorderable) return;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    if (!reorderable || !draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = (targetId: string) => (e: React.DragEvent) => {
    if (!reorderable || !draggingId || !section.onReorder) return;
    e.preventDefault();
    if (draggingId === targetId) {
      handleDragEnd();
      return;
    }
    const ids = section.items.map((i) => i.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) {
      handleDragEnd();
      return;
    }
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    section.onReorder(next);
    handleDragEnd();
  };

  const scrollable = section.scrollable;

  return (
    <div className={`px-2 ${scrollable ? "flex min-h-0 flex-1 flex-col pb-1 pt-2" : "shrink-0 border-t border-white/[0.06] px-0 py-2"}`}>
      <h3 className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
        {section.title}
      </h3>
      {section.items.length === 0 ? (
        <p className="px-2.5 py-1 text-[12px] text-white/30">
          {searching && section.searchable ? "No matches." : "No items yet."}
        </p>
      ) : (
        <ul className={`flex flex-col gap-px ${scrollable ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
          {section.items.map((item) => {
            const draggable = reorderable && item.draggable !== false;
            const isDragging = draggingId === item.id;
            const isDropTarget = dragOverId === item.id && draggingId !== item.id;
            return (
              <li
                key={item.id}
                draggable={draggable}
                onDragStart={draggable ? handleDragStart(item.id) : undefined}
                onDragOver={draggable ? handleDragOver(item.id) : undefined}
                onDragLeave={
                  draggable ? () => setDragOverId((cur) => (cur === item.id ? null : cur)) : undefined
                }
                onDrop={draggable ? handleDrop(item.id) : undefined}
                onDragEnd={draggable ? handleDragEnd : undefined}
                className={`relative ${
                  isDropTarget
                    ? "before:absolute before:inset-x-1 before:-top-px before:h-px before:bg-[#3ecf8e]"
                    : ""
                } ${isDragging ? "opacity-40" : ""}`}
              >
                <SubItemButton
                  item={item}
                  active={item.id === activeItem}
                  onClick={() => onSelectItem(item.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SubSidebarSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <div className="border-b border-white/[0.06] px-3 py-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/25"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] pl-7 pr-2 py-1.5 text-[12px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16]"
        />
      </div>
    </div>
  );
}

function SubItemButton({
  item,
  active,
  onClick,
}: {
  item: SubItem;
  active: boolean;
  onClick: () => void;
}) {
  const hasMenu = Boolean(item.onDelete || item.onRename || item.onPin || item.onArchive);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const menuPopupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync draft with label if it changes externally (after optimistic rename)
  const [lastLabel, setLastLabel] = useState(item.label);
  if (item.label !== lastLabel && !renaming) {
    setLastLabel(item.label);
    setDraft(item.label);
  }

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !menuContainerRef.current?.contains(target) &&
        !menuPopupRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Reposition the portal-rendered menu while open (scroll/resize)
  useEffect(() => {
    if (!menuOpen) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuOpen]);

  // Focus & select input when rename mode activates
  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.label) {
      item.onRename?.(trimmed);
    } else {
      setDraft(item.label);
    }
    setRenaming(false);
  }, [draft, item]);

  const statusCls =
    item.status === "running"
      ? "bg-[#3ecf8e] shadow-[0_0_5px_#3ecf8e]"
      : item.status === "rebooting"
        ? "bg-amber-400"
        : item.status === "stopped"
          ? "bg-white/25"
          : null;

  const cls = `group/sub flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2.5 text-left text-[13px] transition-colors sm:py-1.5 ${
    active
      ? "bg-white/[0.06] text-white"
      : "text-white/65 hover:bg-white/[0.04] hover:text-white"
  }`;

  const statusDot = statusCls ? (
    <span aria-hidden className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusCls}`} />
  ) : null;

  const trailing = item.streaming ? (
    <Loader2
      className="h-3 w-3 shrink-0 animate-spin text-[#3ecf8e]/70"
      aria-label="Generating…"
    />
  ) : item.external ? (
    <ExternalLink className="h-3 w-3 shrink-0 text-white/35" aria-hidden />
  ) : null;

  // ── Inline rename mode ────────────────────────────────────────────────────
  if (renaming) {
    return (
      <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-2.5 sm:py-1.5 ${active ? "bg-white/[0.06]" : ""}`}>
        {statusDot}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
            if (e.key === "Escape") { setDraft(item.label); setRenaming(false); }
          }}
          onBlur={commitRename}
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setDraft(item.label); setRenaming(false); }}
          aria-label="Cancel rename"
          className="shrink-0 text-white/30 hover:text-white/60"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  // ── 3-dots context menu ───────────────────────────────────────────────────
  const menuButton = hasMenu ? (
    <div
      ref={menuContainerRef}
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        aria-label="More options"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/[0.08] hover:text-white/70 focus:outline-none"
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
      </button>

      {menuOpen && menuPos && createPortal(
        <div
          ref={menuPopupRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
          className="z-[60] min-w-[148px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1a1a] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
        >
          {item.onRename && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setDraft(item.label); setRenaming(true); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Pencil className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
              Rename
            </button>
          )}
          {item.onPin && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); item.onPin?.(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Pin className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
              {item.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {item.onArchive && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); item.onArchive?.(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Archive className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
              {item.archived ? "Unarchive" : "Archive"}
            </button>
          )}
          {item.onDelete && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); item.onDelete?.(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-red-300/80 transition-colors hover:bg-red-500/[0.08] hover:text-red-300"
            >
              <Trash2 className="h-3 w-3 shrink-0" aria-hidden />
              {item.deleteLabel ?? "Delete"}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  ) : null;

  // ── Shared content span ───────────────────────────────────────────────────
  const content = (
    <span className="flex min-w-0 items-center gap-2">
      {statusDot}
      <span className="truncate">{item.label}</span>
    </span>
  );

  // ── Link variant ──────────────────────────────────────────────────────────
  if (item.href) {
    return (
      <Link href={item.href} onClick={onClick} className={cls}>
        {content}
        {trailing}
      </Link>
    );
  }

  // ── Button variant (with or without menu) ─────────────────────────────────
  return (
    <div
      className={cls}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {content}
      <span className="flex shrink-0 items-center gap-1">
        {trailing}
        {menuButton}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mobile drawer                                                             */
/* -------------------------------------------------------------------------- */

function MobileDrawer({
  tool,
  sections,
  activeTool,
  activeItem,
  onSelectItem,
  onClose,
  onCreate,
  search,
  onSearchChange,
  searchPlaceholder,
}: {
  tool: Tool;
  sections: SubSection[];
  activeTool: ToolId;
  activeItem: string;
  onSelectItem: (id: string) => void;
  onClose: () => void;
  onCreate?: () => void;
  search?: string;
  onSearchChange?: (next: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex sm:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      {/* Side-by-side layout: primary rail + sub-sidebar, mirroring desktop */}
      <aside className="relative flex w-[92%] max-w-[320px] bg-[#0f0f0f] shadow-[16px_0_48px_rgba(0,0,0,0.45)]">
        {/* Primary rail */}
        <div className="flex w-12 shrink-0 flex-col border-r border-white/[0.08] py-2">
          <nav
            aria-label="Tools"
            className="flex flex-col items-center gap-0.5 px-1.5"
          >
            <RailButton
              icon={<Home className="h-4 w-4" aria-hidden />}
              label="Home"
              href="/"
              onClick={onClose}
            />
            <Separator />
            {TOOLS.map((t) => (
              <RailButton
                key={t.id}
                icon={<t.icon className="h-4 w-4" aria-hidden />}
                label={t.name}
                active={t.id === activeTool}
                href={`/dashboard/${t.id}`}
                onClick={onClose}
              />
            ))}
          </nav>

          <div className="mt-auto flex flex-col items-center gap-0.5 px-1.5">
            <Separator />
            <RailButton
              icon={<Settings className="h-4 w-4" aria-hidden />}
              label="Settings"
              active={activeTool === "settings"}
              href="/dashboard/settings"
              onClick={onClose}
            />
          </div>
        </div>

        {/* Sub-sidebar */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#171717]">
          <div className="flex h-12 items-center justify-between border-b border-white/[0.08] px-2">
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center gap-2 px-1 text-[13px] font-medium tracking-[-0.01em]"
            >
              <Logo className="h-4 w-4" />
              yoga
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <SubSidebarHeader tool={tool} onCreate={onCreate} />
          {onSearchChange ? (
            <SubSidebarSearch
              value={search ?? ""}
              onChange={onSearchChange}
              placeholder={searchPlaceholder ?? "Search…"}
            />
          ) : null}
          <SubSidebarBody
            sections={sections}
            activeItem={activeItem}
            onSelectItem={onSelectItem}
            searching={Boolean(search && search.trim().length > 0)}
          />
        </div>
      </aside>
    </div>
  );
}
