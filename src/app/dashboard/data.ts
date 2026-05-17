import type { LucideIcon } from "lucide-react";
import { MessageSquare, Server, Waypoints } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Tools                                                                     */
/* -------------------------------------------------------------------------- */

export type ToolId = "vps" | "ai" | "chat";

export type Tool = {
  id: ToolId;
  name: string;
  tag: string;
  icon: LucideIcon;
  createLabel: string;
  searchLabel: string;
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
] as const;

/* -------------------------------------------------------------------------- */
/*  VPS instances                                                             */
/* -------------------------------------------------------------------------- */

export type VpsStatus = "running" | "stopped" | "rebooting";

export type VpsInstance = {
  id: string;
  name: string;
  region: string;
  ipv4: string;
  status: VpsStatus;
  cpu: number;
  memory: number;
  disk: number;
  uptime: string;
  vcpu: number;
  memoryGb: number;
  diskGb: number;
  /* Extended fields */
  osName?: string;
  bandwidthMbps?: number;
  expiresAt?: string;
  zone?: string;
  transferUsedGb?: number;
  transferTotalGb?: number;
};

export const VPS_INSTANCES: VpsInstance[] = [
  {
    id: "v1",
    name: "edge-sg-1",
    region: "Singapore · SG1",
    ipv4: "139.162.42.18",
    status: "running",
    cpu: 18,
    memory: 42,
    disk: 28,
    uptime: "14d 3h",
    vcpu: 2,
    memoryGb: 4,
    diskGb: 80,
    osName: "Ubuntu 22.04 LTS",
    bandwidthMbps: 100,
    expiresAt: "2026-08-01",
    zone: "SG1-A",
    transferUsedGb: 142,
    transferTotalGb: 1000,
  },
  {
    id: "v2",
    name: "worker-de-2",
    region: "Frankfurt · FRA1",
    ipv4: "139.162.55.102",
    status: "running",
    cpu: 67,
    memory: 71,
    disk: 54,
    uptime: "3d 11h",
    vcpu: 4,
    memoryGb: 8,
    diskGb: 160,
    osName: "Ubuntu 22.04 LTS",
    bandwidthMbps: 200,
    expiresAt: "2026-09-15",
    zone: "FRA1-B",
    transferUsedGb: 634,
    transferTotalGb: 2000,
  },
  {
    id: "v3",
    name: "dev-sandbox",
    region: "Jakarta · ID1",
    ipv4: "—",
    status: "stopped",
    cpu: 0,
    memory: 0,
    disk: 12,
    uptime: "—",
    vcpu: 1,
    memoryGb: 2,
    diskGb: 40,
    osName: "Debian 12",
    bandwidthMbps: 50,
    expiresAt: "2026-07-01",
    zone: "ID1-A",
    transferUsedGb: 0,
    transferTotalGb: 500,
  },
  {
    id: "v4",
    name: "bot-runner",
    region: "US West · SJC1",
    ipv4: "139.162.98.4",
    status: "running",
    cpu: 23,
    memory: 55,
    disk: 18,
    uptime: "9d 2h",
    vcpu: 2,
    memoryGb: 4,
    diskGb: 80,
    osName: "CentOS Stream 9",
    bandwidthMbps: 100,
    expiresAt: "2026-10-30",
    zone: "SJC1-A",
    transferUsedGb: 89,
    transferTotalGb: 1000,
  },
];

/* -------------------------------------------------------------------------- */
/*  Firewall rules                                                             */
/* -------------------------------------------------------------------------- */

export type FirewallRule = {
  id: string;
  protocol: "TCP" | "UDP" | "ICMP" | "ALL";
  port: string;
  cidrBlock: string;
  action: "ACCEPT" | "DROP";
  description: string;
};

export const VPS_FIREWALL_RULES: Record<string, FirewallRule[]> = {
  v1: [
    { id: "fr1", protocol: "TCP",  port: "22",   cidrBlock: "0.0.0.0/0",  action: "ACCEPT", description: "SSH" },
    { id: "fr2", protocol: "TCP",  port: "80",   cidrBlock: "0.0.0.0/0",  action: "ACCEPT", description: "HTTP" },
    { id: "fr3", protocol: "TCP",  port: "443",  cidrBlock: "0.0.0.0/0",  action: "ACCEPT", description: "HTTPS" },
    { id: "fr4", protocol: "ICMP", port: "-1",   cidrBlock: "0.0.0.0/0",  action: "ACCEPT", description: "Ping" },
  ],
  v2: [
    { id: "fr5", protocol: "TCP",  port: "22",   cidrBlock: "10.0.0.0/8", action: "ACCEPT", description: "SSH (internal)" },
    { id: "fr6", protocol: "TCP",  port: "3000", cidrBlock: "0.0.0.0/0",  action: "ACCEPT", description: "App server" },
    { id: "fr7", protocol: "TCP",  port: "5432", cidrBlock: "10.0.0.0/8", action: "ACCEPT", description: "PostgreSQL" },
    { id: "fr8", protocol: "TCP",  port: "6379", cidrBlock: "10.0.0.0/8", action: "ACCEPT", description: "Redis" },
  ],
  v3: [],
  v4: [
    { id: "fr9",  protocol: "TCP", port: "22",   cidrBlock: "0.0.0.0/0",  action: "ACCEPT", description: "SSH" },
    { id: "fr10", protocol: "TCP", port: "8080", cidrBlock: "0.0.0.0/0",  action: "ACCEPT", description: "Bot API" },
  ],
};

/* -------------------------------------------------------------------------- */
/*  SSH keys                                                                   */
/* -------------------------------------------------------------------------- */

export type SshKey = {
  id: string;
  name: string;
  publicKey: string;
  createdAt: string;
  boundInstances: string[];
};

export const VPS_SSH_KEYS: SshKey[] = [
  {
    id: "k1",
    name: "macbook-personal",
    publicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC3xK9mP2wLqR7vN4tJ8uFdYeH1oIzXbMcSgWkA+nQpV6jE",
    createdAt: "2026-01-15",
    boundInstances: ["v1", "v4"],
  },
  {
    id: "k2",
    name: "deploy-bot",
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKq8mXv2N7wPcR4tYeF6jDhBsLuGkOiWnAmQpXvZyTbE",
    createdAt: "2026-02-20",
    boundInstances: ["v2"],
  },
];

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
  { slug: "claude-opus-4",       name: "Claude Opus 4",       provider: "Anthropic", providerCode: "AN", contextWindow: "200,000", inputPrice: "$15.00", outputPrice: "$75.00",  modelId: "claude-opus-4-5" },
  { slug: "claude-sonnet-4",     name: "Claude Sonnet 4",     provider: "Anthropic", providerCode: "AN", contextWindow: "200,000", inputPrice: "$3.00",  outputPrice: "$15.00",  modelId: "claude-sonnet-4-5" },
  { slug: "gpt-4o",              name: "GPT-4o",              provider: "OpenAI",    providerCode: "OA", contextWindow: "128,000", inputPrice: "$5.00",  outputPrice: "$15.00",  modelId: "gpt-4o-2024-05-13" },
  { slug: "gpt-4o-mini",        name: "GPT-4o Mini",         provider: "OpenAI",    providerCode: "OA", contextWindow: "128,000", inputPrice: "$0.15",  outputPrice: "$0.60",   modelId: "gpt-4o-mini" },
  { slug: "gpt-5",               name: "GPT-5",               provider: "OpenAI",    providerCode: "OA", contextWindow: "256,000", inputPrice: "$30.00", outputPrice: "$60.00",  modelId: "gpt-5" },
  { slug: "llama-3-70b",         name: "Llama 3 70B",         provider: "Meta",      providerCode: "ME", contextWindow: "8,192",   inputPrice: "$0.50",  outputPrice: "$1.50",   modelId: "meta-llama/Meta-Llama-3-70B-Instruct" },
  { slug: "mistral-large",       name: "Mistral Large",       provider: "Mistral",   providerCode: "MI", contextWindow: "32,768",  inputPrice: "$4.00",  outputPrice: "$12.00",  modelId: "mistral-large-latest" },
  { slug: "voyage-3",            name: "Voyage 3",            provider: "Voyage",    providerCode: "VO", contextWindow: "32,000",  inputPrice: "$0.06",  outputPrice: "—",       modelId: "voyage-3" },
];

/* -------------------------------------------------------------------------- */
/*  Chat conversations                                                        */
/* -------------------------------------------------------------------------- */

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ChatConversation = {
  id: string;
  title: string;
  snippet: string;
  model: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export const CHAT_CONVERSATIONS: ChatConversation[] = [
  {
    id: "c1",
    title: "Debounce a react effect",
    snippet: "Show me the minimal version.",
    model: "claude-opus-4",
    updatedAt: "just now",
    messages: [
      { id: "m1", role: "user", content: "How do I debounce a react effect?" },
      {
        id: "m2",
        role: "assistant",
        content:
          "Usually you don't debounce the effect itself — you debounce the value that feeds it. Derive a debounced version of your input and only let the effect run when the debounced value changes.",
      },
      { id: "m3", role: "user", content: "Show me the minimal version." },
      {
        id: "m4",
        role: "assistant",
        content:
          "```tsx\nconst debounced = useDebouncedValue(query, 300);\n\nuseEffect(() => {\n  if (!debounced) return;\n  fetch(`/api/search?q=${debounced}`).then(/* … */);\n}, [debounced]);\n```",
      },
    ],
  },
  {
    id: "c2",
    title: "Next.js 16 server actions",
    snippet: "Explain useActionState.",
    model: "claude-opus-4",
    updatedAt: "2h ago",
    messages: [
      { id: "m1", role: "user", content: "Explain useActionState in Next.js 16." },
      {
        id: "m2",
        role: "assistant",
        content:
          "`useActionState(action, initialState)` returns `[state, formAction, isPending]`. The action has the shape `(prev, formData) => newState`, so you can drive a whole form flow from a single server action while keeping the UI inline.",
      },
    ],
  },
  {
    id: "c3",
    title: "Supabase OAuth flow",
    snippet: "Walk me through PKCE.",
    model: "gpt-5",
    updatedAt: "yesterday",
    messages: [
      { id: "m1", role: "user", content: "Walk me through the PKCE flow in Supabase OAuth." },
      {
        id: "m2",
        role: "assistant",
        content:
          "Browser generates a code verifier + challenge, sends the challenge to the provider, receives a code back at your callback, then exchanges code + verifier for a session. Supabase's `exchangeCodeForSession` handles the last step.",
      },
    ],
  },
  {
    id: "c4",
    title: "VPS setup on bare linux",
    snippet: "Best way to install systemd units?",
    model: "claude-opus-4",
    updatedAt: "2d ago",
    messages: [
      { id: "m1", role: "user", content: "Best way to install systemd units for a node app?" },
      {
        id: "m2",
        role: "assistant",
        content:
          "Drop a `.service` file in `/etc/systemd/system/`, run `systemctl daemon-reload`, then `systemctl enable --now your-app`. Use `Restart=always` and `WorkingDirectory` so the app survives reboots.",
      },
    ],
  },
];
