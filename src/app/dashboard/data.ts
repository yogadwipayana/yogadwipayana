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

export const AI_ROUTES: AiRoute[] = [
  {
    id: "r1",
    name: "default",
    path: "/v1/chat/completions",
    model: "claude-opus-4",
    fallback: "gpt-5",
    provider: "anthropic",
    p50: "124ms",
    p95: "612ms",
    errors: "0.02%",
    requests24h: 12453,
    active: true,
  },
  {
    id: "r2",
    name: "fast",
    path: "/v1/chat/completions",
    model: "gpt-4o-mini",
    fallback: "claude-haiku",
    provider: "openai",
    p50: "89ms",
    p95: "412ms",
    errors: "0.01%",
    requests24h: 4211,
    active: true,
  },
  {
    id: "r3",
    name: "embed",
    path: "/v1/embed",
    model: "voyage-3",
    fallback: "—",
    provider: "voyage",
    p50: "32ms",
    p95: "89ms",
    errors: "0.00%",
    requests24h: 1890,
    active: true,
  },
];

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
/*  AI — API Keys                                                             */
/* -------------------------------------------------------------------------- */

export type AiApiKeyUsageMode = "payg";

export type AiApiKey = {
  id: string;
  label: string;
  maskedKey: string;
  usageMode: AiApiKeyUsageMode;
  createdAt: string;
  lastUsedAt: string | null;
  /** Only present immediately after creation */
  secret?: string;
};

export const AI_API_KEYS: AiApiKey[] = [
  { id: "ak1", label: "production",  maskedKey: "sk-...a7f2", usageMode: "payg", createdAt: "2026-01-10", lastUsedAt: "2026-05-17" },
  { id: "ak2", label: "development", maskedKey: "sk-...c3d8", usageMode: "payg", createdAt: "2026-02-15", lastUsedAt: "2026-05-16" },
];

/* -------------------------------------------------------------------------- */
/*  AI — Usage meters                                                         */
/* -------------------------------------------------------------------------- */

export type AiUsageMeter = {
  id: string;
  label: string;
  description: string;
  valueDisplay: string;
  totalDisplay: string;
  progressPercent: number;
  resetsAt: string | null;
  countdownText: string | null;
};

export const AI_USAGE_METERS: AiUsageMeter[] = [
  {
    id: "credit-balance",
    label: "Credit Balance",
    description: "Available credit to spend on model requests.",
    valueDisplay: "$1.84",
    totalDisplay: "",
    progressPercent: 0,
    resetsAt: null,
    countdownText: null,
  },
  {
    id: "requests",
    label: "Requests Today",
    description: "Total API requests billed today.",
    valueDisplay: "1,204",
    totalDisplay: "",
    progressPercent: 0,
    resetsAt: null,
    countdownText: null,
  },
  {
    id: "tokens",
    label: "Tokens Today",
    description: "Total tokens consumed today.",
    valueDisplay: "124,500",
    totalDisplay: "",
    progressPercent: 0,
    resetsAt: null,
    countdownText: null,
  },
];

/* -------------------------------------------------------------------------- */
/*  AI — Request logs                                                         */
/* -------------------------------------------------------------------------- */

export type AiRequestLog = {
  id: string;
  model: string;
  provider: string;
  appLabel: string | null;
  status: string;
  costDisplay: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number | null;
  planSlug: "free" | "pro" | "payg";
  createdAt: string;
};

export const AI_REQUEST_LOGS: AiRequestLog[] = [
  { id: "l1", model: "claude-opus-4",  provider: "Anthropic", appLabel: "production",  status: "200", costDisplay: "$0.0024", inputTokens: 312,  outputTokens: 156, latencyMs: 634,  planSlug: "pro",  createdAt: "2026-05-17T11:02:14Z" },
  { id: "l2", model: "gpt-4o",         provider: "OpenAI",    appLabel: "production",  status: "200", costDisplay: "$0.0031", inputTokens: 420,  outputTokens: 210, latencyMs: 487,  planSlug: "pro",  createdAt: "2026-05-17T11:01:58Z" },
  { id: "l3", model: "voyage-3",       provider: "Voyage",    appLabel: "development", status: "200", costDisplay: "$0.0002", inputTokens: 512,  outputTokens: 0,   latencyMs: 89,   planSlug: "payg", createdAt: "2026-05-17T11:01:45Z" },
  { id: "l4", model: "claude-opus-4",  provider: "Anthropic", appLabel: "production",  status: "429", costDisplay: "$0.0000", inputTokens: 0,    outputTokens: 0,   latencyMs: null, planSlug: "pro",  createdAt: "2026-05-17T11:01:32Z" },
  { id: "l5", model: "gpt-4o-mini",    provider: "OpenAI",    appLabel: "development", status: "200", costDisplay: "$0.0008", inputTokens: 890,  outputTokens: 445, latencyMs: 312,  planSlug: "pro",  createdAt: "2026-05-17T11:01:18Z" },
  { id: "l6", model: "claude-opus-4",  provider: "Anthropic", appLabel: "production",  status: "200", costDisplay: "$0.0019", inputTokens: 241,  outputTokens: 120, latencyMs: 521,  planSlug: "pro",  createdAt: "2026-05-17T11:00:55Z" },
  { id: "l7", model: "mistral-large",  provider: "Mistral",   appLabel: null,          status: "200", costDisplay: "$0.0012", inputTokens: 180,  outputTokens: 90,  latencyMs: 278,  planSlug: "payg", createdAt: "2026-05-17T10:59:40Z" },
  { id: "l8", model: "llama-3-70b",    provider: "Meta",      appLabel: "development", status: "500", costDisplay: "$0.0000", inputTokens: 0,    outputTokens: 0,   latencyMs: null, planSlug: "free", createdAt: "2026-05-17T10:58:12Z" },
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
  { slug: "gpt-5.5",          name: "GPT-5.5",          provider: "OpenAI",    providerCode: "OA", contextWindow: "256,000", inputPrice: "$30.00", outputPrice: "$60.00", modelId: "gpt-5.5" },
  { slug: "claude-opus-4.7",  name: "Claude Opus 4.7",  provider: "Anthropic", providerCode: "AN", contextWindow: "200,000", inputPrice: "$15.00", outputPrice: "$75.00", modelId: "claude-opus-4-7" },
  { slug: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", provider: "Anthropic", providerCode: "AN", contextWindow: "200,000", inputPrice: "$3.00",  outputPrice: "$15.00", modelId: "claude-sonnet-4-6" },
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
