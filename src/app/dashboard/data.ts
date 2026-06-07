import type { LucideIcon } from "lucide-react";
import { ImagePlus, MessageSquare, Server, Settings, Waypoints } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Tools                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Includes "settings" so the DashboardShell can host /dashboard/settings using
 * the same primary-sidebar + sub-sidebar layout. Settings is intentionally
 * absent from `TOOLS` because the primary rail renders it separately at the
 * bottom (alongside the dedicated Settings rail button).
 */
export type ToolId = "vps" | "ai" | "chat" | "image" | "settings";

export type Tool = {
  id: ToolId;
  name: string;
  tag: string;
  icon: LucideIcon;
  createLabel: string;
  searchLabel: string;
};

export const SETTINGS_TOOL: Tool = {
  id: "settings",
  name: "Settings",
  tag: "Account",
  icon: Settings,
  createLabel: "",
  searchLabel: "",
};

export const TOOLS: readonly Tool[] = [
  {
    id: "vps",
    name: "VPS Control",
    tag: "Infrastructure",
    icon: Server,
    createLabel: "New instance",
    searchLabel: "Search instances",
  },
  {
    id: "ai",
    name: "AI Router",
    tag: "Models",
    icon: Waypoints,
    createLabel: "New route",
    searchLabel: "Search routes",
  },
  {
    id: "chat",
    name: "Chat AI",
    tag: "Assistants",
    icon: MessageSquare,
    createLabel: "New conversation",
    searchLabel: "Search conversations",
  },
  {
    id: "image",
    name: "Image Studio",
    tag: "Media",
    icon: ImagePlus,
    createLabel: "New generation",
    searchLabel: "Search images",
  },
] as const;

/* -------------------------------------------------------------------------- */
/*  VPS instances — UI shape (camelCase). The canonical wire shape lives in   */
/*  src/lib/client/vps-api.ts. Use toUiInstance() in vps-mappers.ts to bridge.*/
/* -------------------------------------------------------------------------- */

export type VpsStatus = "running" | "stopped" | "rebooting";

export type VpsInstance = {
  /** Internal UUID — used by /api/vps/instances/:id routes */
  id: string;
  /** Tencent's instance id — used by SSH key bind/unbind matching */
  externalInstanceId: string;
  name: string;
  region: string;
  zone?: string;
  ipv4: string;
  status: VpsStatus;
  /** Raw provider state, useful for transitional states (STARTING, STOPPING, …) */
  providerStatus: string;
  /** True for user-added SSH targets with no cloud provider behind them. */
  isCustom: boolean;
  vcpu: number;
  memoryGb: number;
  diskGb: number;
  bandwidthMbps?: number;
  osName?: string;
  expiresAt?: string;
};

/* -------------------------------------------------------------------------- */
/*  Firewall rules                                                            */
/* -------------------------------------------------------------------------- */

export type FirewallRule = {
  /** Synthetic local id — Tencent rules don't have stable IDs */
  id: string;
  protocol: "TCP" | "UDP" | "ICMP" | "ALL";
  port: string;
  cidrBlock: string;
  action: "ACCEPT" | "DROP";
  description: string;
};

/* -------------------------------------------------------------------------- */
/*  SSH keys                                                                  */
/* -------------------------------------------------------------------------- */

export type SshKey = {
  id: string;
  name: string;
  publicKey: string;
  createdAt: string;
  boundInstances: string[];
};

/* -------------------------------------------------------------------------- */
/*  AI Router routes                                                          */
/* -------------------------------------------------------------------------- */

export type AiRoute = {
  id: string;
  name: string;
  path: string;
  model: string;
  fallback: string;
  provider: "anthropic" | "openai" | "voyage";
  p50: string;
  p95: string;
  errors: string;
  requests24h: number;
  active: boolean;
};

export type AiCall = {
  ts: string;
  method: "POST";
  path: string;
  model: string;
  ms: string;
  status: 200 | 429 | 500;
};

export const AI_RECENT_CALLS: AiCall[] = [
  { ts: "19:02:14", method: "POST", path: "/v1/chat/completions", model: "claude-opus-4", ms: "312ms", status: 200 },
  { ts: "19:02:12", method: "POST", path: "/v1/chat/completions", model: "gpt-5", ms: "214ms", status: 200 },
  { ts: "19:02:09", method: "POST", path: "/v1/embed", model: "voyage-3", ms: "89ms", status: 200 },
  { ts: "19:02:05", method: "POST", path: "/v1/chat/completions", model: "claude-opus-4", ms: "441ms", status: 200 },
  { ts: "19:01:58", method: "POST", path: "/v1/chat/completions", model: "gpt-5", ms: "—", status: 429 },
  { ts: "19:01:51", method: "POST", path: "/v1/chat/completions", model: "claude-opus-4", ms: "287ms", status: 200 },
];

/* -------------------------------------------------------------------------- */
/*  AI — Model catalog                                                        */
/* -------------------------------------------------------------------------- */

export type AiModel = {
  slug: string;
  name: string;
  provider: string;
  providerCode: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  modelId: string;
};

export const AI_MODELS: AiModel[] = [
  { slug: "gpt-5.5",          name: "GPT-5.5",          provider: "OpenAI",    providerCode: "OA", contextWindow: "1,000,000", inputPrice: "$5.00",  outputPrice: "$30.00", modelId: "gpt-5.5" },
  { slug: "claude-opus-4.8",  name: "Claude Opus 4.8",  provider: "Anthropic", providerCode: "AN", contextWindow: "1,000,000", inputPrice: "$5.00",  outputPrice: "$25.00", modelId: "claude-opus-4.8" },
  { slug: "claude-opus-4.7",  name: "Claude Opus 4.7",  provider: "Anthropic", providerCode: "AN", contextWindow: "1,000,000", inputPrice: "$5.00",  outputPrice: "$25.00", modelId: "claude-opus-4.7" },
  { slug: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", provider: "Anthropic", providerCode: "AN", contextWindow: "1,000,000", inputPrice: "$3.00",  outputPrice: "$15.00", modelId: "claude-sonnet-4.6" },
];

/* -------------------------------------------------------------------------- */
/*  Chat conversations                                                        */
/* -------------------------------------------------------------------------- */

export type ToolEvent = {
  call_id: string;
  name: string;
  status: "running" | "done";
  args?: unknown;
  result?: unknown;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolEvents?: ToolEvent[];
  followUps?: string[];
};

export type ChatMode = "chat" | "image";

export type ChatConversationSummary = {
  id: string;
  title: string;
  model: string;
  mode: ChatMode;
  updated_at: string;
  is_public?: boolean;
  share_token?: string | null;
};

export const CHAT_MODES: { slug: ChatMode; name: string; description: string }[] = [
  { slug: "chat", name: "Chat", description: "Regular text conversation" },
  { slug: "image", name: "Image", description: "Generate images from prompts" },
];
