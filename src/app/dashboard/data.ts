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
