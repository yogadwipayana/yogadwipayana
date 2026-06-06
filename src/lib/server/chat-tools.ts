import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";

import { normalizeAspectInput, presetToSize } from "@/lib/aspect-ratio";
import {
  addFirewallRule,
  bindSshKeyToInstance,
  getInstanceDetail,
  getUserInstanceById,
  listFirewallRules,
  listSshKeys,
  listUserInstances,
  performInstanceAction,
  removeFirewallRuleByDefinition,
  unbindSshKeyFromInstance,
} from "@/lib/server/dashboard-service";
import { generateImage } from "@/lib/server/image-gen";
import { generateAndRecord } from "@/lib/server/image-service";
import { safeFetch, validatePublicHttpUrl } from "@/lib/server/safe-fetch";
import { getSshCredential } from "@/lib/server/ssh-credential-service";
import { sshExec } from "@/lib/server/ssh-exec";
import { requestApproval } from "@/lib/server/terminal-approval-store";

/**
 * Server-side tools the chat AI can call. Implementations live in this module
 * so the chat routes only need to dispatch by name.
 *
 * Web search prefers Tavily when `TAVILY_API_KEY` is set; otherwise it falls
 * back to scraping DuckDuckGo's HTML endpoint (no key required, but fragile).
 */

type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

export const CHAT_TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the public web for recent or up-to-date information. Use this when the answer may have changed after your training cutoff (current events, today's prices, latest releases, recent docs). Returns a list of result titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query.",
          },
          max_results: {
            type: "integer",
            description: "Maximum number of results to return. Defaults to 5, capped at 10.",
            minimum: 1,
            maximum: 10,
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Fetch a single web page and return its readable text content. Use this after web_search to read a specific result, or when the user gives you a URL to summarize. Returns the page title and plain-text content (truncated to ~8 KB).",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "An absolute http(s) URL to fetch.",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description:
        "Return the current date and time. Call this whenever the user asks about 'today', 'now', or any time-of-day reasoning — your training cutoff is in the past, so do not guess. Returns ISO-8601 UTC plus a localized rendering in the requested IANA timezone.",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description:
              "Optional IANA timezone name (e.g. 'Asia/Jakarta', 'America/Los_Angeles'). Defaults to UTC.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_list",
      description:
        "List the signed-in user's Tencent Cloud Lighthouse VPS instances. Read-only. Returns id, name, status, region, public/private IP, CPU, memory, OS, and expiry for each instance. Use this to answer questions like 'is my prod box up?' or 'how many VPS do I have?'.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_describe",
      description:
        "Read full details for one of the signed-in user's VPS instances, including traffic-package usage. Read-only. The `id` is the internal UUID returned by `vps_list` (the `id` field, not `external_instance_id`).",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "Internal instance id (the `id` field from `vps_list`).",
          },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_action",
      description:
        "Perform a power action on a VPS instance: start, stop, or reboot. WRITE OPERATION. For `stop` and `reboot`, you MUST first describe the impact in chat and get explicit user confirmation in the same turn (e.g. user said 'yes, reboot it'). `start` is safe and can be executed without confirmation. The `id` is the internal UUID from `vps_list`.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Internal instance id (the `id` field from `vps_list`).",
          },
          action: {
            type: "string",
            enum: ["start", "stop", "reboot"],
            description: "The power action to perform.",
          },
        },
        required: ["id", "action"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_firewall_list",
      description:
        "List inbound firewall rules for a VPS instance. Read-only. Returns each rule's protocol, port, source CIDR, action (ACCEPT/DROP), and description. The `id` is the internal UUID from `vps_list`.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Internal instance id (the `id` field from `vps_list`).",
          },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_firewall_add",
      description:
        "Add an inbound firewall rule to a VPS instance. WRITE OPERATION. Confirm with the user in chat before calling, especially for broad rules (e.g. 0.0.0.0/0 on sensitive ports like 22, 3306, 5432, 6379). Port can be a single port (`80`), a range (`80-443`), or `ALL`.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Internal instance id (the `id` field from `vps_list`).",
          },
          protocol: {
            type: "string",
            enum: ["TCP", "UDP", "ICMP", "ALL"],
          },
          port: {
            type: "string",
            description: "Single port, range (e.g. `80-443`), or `ALL`.",
          },
          cidr_block: {
            type: "string",
            description: "Source CIDR (e.g. `0.0.0.0/0` for any, `203.0.113.0/24`).",
          },
          action: {
            type: "string",
            enum: ["ACCEPT", "DROP"],
          },
          description: {
            type: "string",
            description: "Optional human-readable description of the rule.",
          },
        },
        required: ["id", "protocol", "port", "cidr_block", "action"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_firewall_remove",
      description:
        "Remove an inbound firewall rule from a VPS instance by its full definition (protocol + port + cidr + action, plus description if it had one). WRITE OPERATION. Confirm with the user in chat before calling. Use `vps_firewall_list` first to see the exact rule definitions.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Internal instance id (the `id` field from `vps_list`).",
          },
          protocol: {
            type: "string",
            enum: ["TCP", "UDP", "ICMP", "ALL"],
          },
          port: { type: "string" },
          cidr_block: { type: "string" },
          action: {
            type: "string",
            enum: ["ACCEPT", "DROP"],
          },
          description: {
            type: "string",
            description:
              "Match the existing rule's description (omit only if the rule had no description).",
          },
        },
        required: ["id", "protocol", "port", "cidr_block", "action"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_ssh_keys_list",
      description:
        "List the user's SSH key pairs (across all their VPS instances, account-scoped). Read-only. Returns each key's id, name, public key, and which instance external ids it is currently associated with.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_ssh_bind",
      description:
        "Bind an existing SSH key pair to a VPS instance so the user can log in with that key. WRITE OPERATION. Confirm with the user in chat before calling. The `id` is the internal UUID from `vps_list`; `key_id` is the `KeyId` from `vps_ssh_keys_list`.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Internal instance id (the `id` field from `vps_list`).",
          },
          key_id: {
            type: "string",
            description: "Tencent SSH key id (the `KeyId` field from `vps_ssh_keys_list`).",
          },
        },
        required: ["id", "key_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vps_ssh_unbind",
      description:
        "Unbind an SSH key pair from a VPS instance. WRITE OPERATION. Confirm with the user in chat before calling. After unbinding, that key can no longer log in to the instance.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Internal instance id (the `id` field from `vps_list`).",
          },
          key_id: {
            type: "string",
            description: "Tencent SSH key id (the `KeyId` field from `vps_ssh_keys_list`).",
          },
        },
        required: ["id", "key_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_run",
      description:
        "Run a non-interactive shell command on one of the user's VPS instances over SSH and return stdout, stderr, and exit code. WRITE OPERATION — the command runs on a real server. Confirm with the user in chat before calling unless the command is obviously read-only (e.g. `df -h`, `uptime`, `ls`, `cat /etc/os-release`). Output is truncated at ~16 KB per stream. Default timeout is 15s.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "Internal instance id (the `id` field from `vps_list`). Manually-added (custom) VPS instances appear in `vps_list` with their own id, so use that id directly.",
          },
          command: {
            type: "string",
            description:
              "The shell command to execute non-interactively. Single command line; chain with `&&` if needed.",
          },
          timeout_ms: {
            type: "integer",
            description:
              "Optional timeout in milliseconds (default 15000, max 60000).",
            minimum: 1000,
            maximum: 60000,
          },
        },
        required: ["id", "command"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_terminal",
      description:
        "Open an interactive SSH terminal session for a VPS instance directly inside the chat. Use this when the user wants to run commands that benefit from real-time output, multi-step operations, or interactive programs (e.g. installing Docker, running a build, watching logs). After calling this, use terminal_run to propose individual commands for the user to approve and execute. Requires saved SSH credentials for the instance (user must have connected via /dashboard/vps/terminal at least once).",
      parameters: {
        type: "object",
        properties: {
          instance_id: {
            type: "string",
            description:
              "Internal instance id (the `id` field from `vps_list`). Manually-added (custom) VPS instances appear in `vps_list` with their own id, so use that id directly. If omitted and the user has exactly one instance, that instance is used automatically.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "terminal_run",
      description:
        "Propose a shell command to run in the open interactive terminal. The user MUST approve the command before it executes — you MUST call open_terminal first. The stream pauses until the user clicks Run or Deny. Use this for each step of a multi-command task (e.g. update, install, configure). Do NOT chain unrelated commands into one call — propose them one at a time so the user can review each step.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The shell command to propose. Shown to the user for approval before it runs in the terminal.",
          },
          reason: {
            type: "string",
            description:
              "Brief one-sentence explanation of why this command is needed. Shown to the user alongside the command.",
          },
          instance_id: {
            type: "string",
            description:
              "Internal instance id if multiple terminals are open. Omit to target the most recently opened terminal.",
          },
        },
        required: ["command", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "image_generate",
      description:
        "Generate an image from a text prompt. Use whenever the user asks for an image, picture, drawing, illustration, photo, logo, diagram, or any visual content. Returns a URL to the saved image. You MUST embed the returned URL in your reply as a markdown image: ![brief description](url). Generation takes ~60-90 seconds — do not call this tool more than once per user request unless the user explicitly asks for a regeneration or a different variant.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "A detailed description of the image to generate. Be specific about subject, style, composition, and lighting. Rewrite vague user requests into rich descriptions.",
          },
          aspect_ratio: {
            type: "string",
            enum: ["auto", "square", "portrait", "landscape", "wide", "tall"],
            description:
              "Optional aspect-ratio preset. 'square' (1:1), 'portrait' (3:4), 'landscape' (4:3), 'wide' (16:9), 'tall' (9:16), or 'auto' to let the model decide. Defaults to 'auto'.",
          },
          size: {
            type: "string",
            description:
              "Deprecated. Prefer `aspect_ratio`. Free-form size like '1024x1024' is still accepted for backwards compatibility.",
          },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "image_edit",
      description:
        "Edit or transform an existing image using a text prompt. Use this when the user attaches an image and asks you to change, restyle, or build on it (\"make this black and white\", \"add a cat\", \"in the style of Van Gogh\", etc.), or clicks an Iterate button on a previously generated image. Returns a URL to the saved image — embed it as `![brief description](url)`. Same ~60–90s latency as image_generate. Don't call more than once per request unless the user asks for a variant.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "A detailed description of the edit. Describe both what to keep from the source image and what should change. Rewrite vague requests into rich descriptions.",
          },
          image_url: {
            type: "string",
            description:
              "Absolute URL of the reference image to edit. Use the URL from a recent image_generate result, an attachment the user uploaded, or any publicly reachable URL.",
          },
          aspect_ratio: {
            type: "string",
            enum: ["auto", "square", "portrait", "landscape", "wide", "tall"],
            description:
              "Optional aspect-ratio preset for the output. Defaults to 'auto', which preserves the source aspect ratio when supported.",
          },
          size: {
            type: "string",
            description:
              "Deprecated. Prefer `aspect_ratio`. Free-form size like '1024x1024' is still accepted.",
          },
        },
        required: ["prompt", "image_url"],
        additionalProperties: false,
      },
    },
  },
];

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_BYTES = 8_000;
type SearchResult = { title: string; url: string; snippet: string };

/**
 * Search via the 9Router unified gateway (`POST /v1/search`).
 * Reuses OPENAI_BASE_URL and OPENAI_API_KEY — no extra env vars needed.
 */
async function nineRouterSearch(
  query: string,
  maxResults: number,
  provider: string,
): Promise<SearchResult[]> {
  const baseUrl = process.env.OPENAI_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("OPENAI_BASE_URL not set");
  const apiKey = process.env.OPENAI_API_KEY;

  const res = await safeFetch(`${baseUrl}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model: provider, query, max_results: maxResults }),
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  if (!res.ok) throw new Error(`9Router/${provider} HTTP ${res.status}`);

  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; snippet?: string }>;
  };
  return (json.results ?? [])
    .filter((r) => r.url)
    .slice(0, maxResults)
    .map((r) => ({
      title: r.title ?? r.url ?? "",
      url: r.url ?? "",
      snippet: r.snippet ?? "",
    }));
}


async function webSearch(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  // 9Router chain: tavily → exa → searxng (reuses OPENAI_BASE_URL + OPENAI_API_KEY)
  if (process.env.OPENAI_BASE_URL) {
    for (const provider of ["tavily", "exa", "searxng"]) {
      try {
        return await nineRouterSearch(query, maxResults, provider);
      } catch {
        // try next provider
      }
    }
  }
  throw new Error("All search providers failed");
}

type FetchResult = { url: string; title: string; text: string; truncated: boolean };

/**
 * Fetch a URL via the 9Router unified gateway (`POST /v1/web/fetch`).
 * Provider order is based on "Best for":
 *   jina-reader  — fastest plain markdown
 *   firecrawl    — JS-rendered pages
 *   exa          — fast text extraction
 *   tavily       — bulk extract
 */
async function nineRouterFetch(url: string, provider: string): Promise<FetchResult> {
  const baseUrl = process.env.OPENAI_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("OPENAI_BASE_URL not set");
  const apiKey = process.env.OPENAI_API_KEY;

  const res = await safeFetch(`${baseUrl}/web/fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model: provider, url, format: "markdown", max_characters: MAX_TEXT_BYTES }),
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  if (!res.ok) throw new Error(`9Router/${provider} HTTP ${res.status}`);

  const json = (await res.json()) as {
    url?: string;
    title?: string;
    content?: { text?: string; length?: number };
  };

  const text = json.content?.text ?? "";
  const truncated = (json.content?.length ?? text.length) > MAX_TEXT_BYTES;
  return {
    url: json.url ?? url,
    title: json.title ?? url,
    text,
    truncated,
  };
}

async function webFetch(rawUrl: string): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  const url = parsed.toString();

  // 9Router chain ordered by Best for: jina-reader → firecrawl → exa → tavily
  if (process.env.OPENAI_BASE_URL) {
    for (const provider of ["jina-reader", "firecrawl", "exa", "tavily"]) {
      try {
        return await nineRouterFetch(url, provider);
      } catch {
        // try next provider
      }
    }
  }

  throw new Error("All fetch providers failed");
}

/**
 * Dispatches a tool call by name. Always returns a JSON string suitable for use
 * as a `tool` message's `content`. Errors are returned as `{ "error": "..." }`
 * so a tool failure surfaces to the model without aborting the chat stream.
 */
export type ToolContext = {
  /** Authenticated Supabase user id. Required for tools that touch user data. */
  userId: string;
  /** Conversation the tool call belongs to (for tools that record per-conv state). */
  conversationId?: string;
  /** Authenticated Supabase client (for tools that need to write rows). */
  supabase?: SupabaseClient;
  /** Optional AbortSignal — propagated to slow tools so they can be cancelled. */
  abortSignal?: AbortSignal;
  /** The tool call id from OpenAI. Required for terminal_run (pending approval key). */
  callId?: string;
};

export async function executeTool(
  name: string,
  argsJson: string,
  context: ToolContext,
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return JSON.stringify({ error: "Invalid JSON arguments" });
  }

  try {
    if (name === "web_search") {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) return JSON.stringify({ error: "Missing query" });
      const requested = Number(args.max_results);
      const max =
        Number.isFinite(requested) && requested > 0
          ? Math.min(10, Math.floor(requested))
          : 5;
      const results = await webSearch(query, max);
      return JSON.stringify({ query, results });
    }

    if (name === "web_fetch") {
      const url = typeof args.url === "string" ? args.url.trim() : "";
      if (!url) return JSON.stringify({ error: "Missing url" });
      const result = await webFetch(url);
      return JSON.stringify(result);
    }

    if (name === "get_current_time") {
      const tz =
        typeof args.timezone === "string" && args.timezone.trim().length > 0
          ? args.timezone.trim()
          : "UTC";
      return JSON.stringify(getCurrentTime(tz));
    }

    if (name === "vps_list") {
      const instances = await listUserInstances(context.userId);
      return JSON.stringify({
        count: instances.length,
        instances: instances.map(serializeInstanceForTool),
      });
    }

    if (name === "vps_describe") {
      const id = typeof args.id === "string" ? args.id.trim() : "";
      if (!id) return JSON.stringify({ error: "Missing id" });
      const detail = await getInstanceDetail(context.userId, id);
      return JSON.stringify(detail);
    }

    if (name === "vps_action") {
      const id = typeof args.id === "string" ? args.id.trim() : "";
      const action = typeof args.action === "string" ? args.action.trim() : "";
      if (!id) return JSON.stringify({ error: "Missing id" });
      if (action !== "start" && action !== "stop" && action !== "reboot") {
        return JSON.stringify({ error: "Invalid action; expected start | stop | reboot" });
      }
      const result = await performInstanceAction({
        userId: context.userId,
        instanceId: id,
        action,
      });
      return JSON.stringify({
        ok: true,
        id,
        action,
        request_id: result.requestId,
        note:
          "Action accepted by Tencent Cloud. Status will transition asynchronously; the user can refresh the dashboard to see the new state.",
      });
    }

    if (name === "vps_firewall_list") {
      const id = typeof args.id === "string" ? args.id.trim() : "";
      if (!id) return JSON.stringify({ error: "Missing id" });
      const rules = await listFirewallRules(context.userId, id);
      return JSON.stringify({ id, count: rules.length, rules });
    }

    if (name === "vps_firewall_add") {
      const id = typeof args.id === "string" ? args.id.trim() : "";
      const protocol = typeof args.protocol === "string" ? args.protocol.trim() : "";
      const port = typeof args.port === "string" ? args.port.trim() : "";
      const cidrBlock = typeof args.cidr_block === "string" ? args.cidr_block.trim() : "";
      const action = typeof args.action === "string" ? args.action.trim() : "";
      const description =
        typeof args.description === "string" && args.description.trim().length > 0
          ? args.description.trim()
          : undefined;
      if (!id || !protocol || !port || !cidrBlock || !action) {
        return JSON.stringify({
          error: "Missing required field (id, protocol, port, cidr_block, action)",
        });
      }
      const result = await addFirewallRule({
        userId: context.userId,
        instanceId: id,
        protocol,
        port,
        cidrBlock,
        action,
        description,
      });
      return JSON.stringify({
        ok: true,
        id,
        rule: { protocol, port, cidr_block: cidrBlock, action, description: description ?? null },
        request_id: result.requestId,
      });
    }

    if (name === "vps_firewall_remove") {
      const id = typeof args.id === "string" ? args.id.trim() : "";
      const protocol = typeof args.protocol === "string" ? args.protocol.trim() : "";
      const port = typeof args.port === "string" ? args.port.trim() : "";
      const cidrBlock = typeof args.cidr_block === "string" ? args.cidr_block.trim() : "";
      const action = typeof args.action === "string" ? args.action.trim() : "";
      const description =
        typeof args.description === "string" && args.description.trim().length > 0
          ? args.description.trim()
          : undefined;
      if (!id || !protocol || !port || !cidrBlock || !action) {
        return JSON.stringify({
          error: "Missing required field (id, protocol, port, cidr_block, action)",
        });
      }
      const result = await removeFirewallRuleByDefinition({
        userId: context.userId,
        instanceId: id,
        protocol,
        port,
        cidrBlock,
        action,
        description,
      });
      return JSON.stringify({
        ok: true,
        id,
        removed: { protocol, port, cidr_block: cidrBlock, action, description: description ?? null },
        request_id: result.requestId,
      });
    }

    if (name === "vps_ssh_keys_list") {
      const keys = await listSshKeys(context.userId);
      return JSON.stringify({
        count: keys.length,
        keys: keys.map((k) => ({
          key_id: k.KeyId,
          key_name: k.KeyName ?? null,
          public_key: k.PublicKey ?? null,
          associated_instance_external_ids: k.AssociatedInstanceIds ?? [],
          created_time: k.CreatedTime ?? null,
        })),
      });
    }

    if (name === "vps_ssh_bind") {
      const id = typeof args.id === "string" ? args.id.trim() : "";
      const keyId = typeof args.key_id === "string" ? args.key_id.trim() : "";
      if (!id || !keyId) {
        return JSON.stringify({ error: "Missing id or key_id" });
      }
      const result = await bindSshKeyToInstance(context.userId, id, keyId);
      return JSON.stringify({ ok: true, id, key_id: keyId, request_id: result.requestId });
    }

    if (name === "vps_ssh_unbind") {
      const id = typeof args.id === "string" ? args.id.trim() : "";
      const keyId = typeof args.key_id === "string" ? args.key_id.trim() : "";
      if (!id || !keyId) {
        return JSON.stringify({ error: "Missing id or key_id" });
      }
      const result = await unbindSshKeyFromInstance(context.userId, id, keyId);
      return JSON.stringify({ ok: true, id, key_id: keyId, request_id: result.requestId });
    }

    if (name === "ssh_run") {
      const id = typeof args.id === "string" ? args.id.trim() : "";
      const command = typeof args.command === "string" ? args.command : "";
      if (!id) return JSON.stringify({ error: "Missing id" });
      if (!command.trim()) return JSON.stringify({ error: "Missing command" });
      const timeoutMs =
        typeof args.timeout_ms === "number" && Number.isFinite(args.timeout_ms)
          ? Math.min(60_000, Math.max(1_000, Math.floor(args.timeout_ms)))
          : 15_000;
      const result = await sshExec({
        userId: context.userId,
        instanceId: id,
        command,
        timeoutMs,
      });
      return JSON.stringify(result);
    }

    if (name === "open_terminal") {
      let instanceId =
        typeof args.instance_id === "string" ? args.instance_id.trim() : "";

      if (!instanceId) {
        const instances = await listUserInstances(context.userId);
        if (instances.length === 0) {
          return JSON.stringify({ error: "No VPS instances found." });
        }
        if (instances.length > 1) {
          return JSON.stringify({
            error: "Multiple instances found. Specify instance_id.",
          });
        }
        instanceId = instances[0].id;
      }

      let instanceName: string;
      if (instanceId === "__custom__") {
        instanceName = "Custom Instance";
      } else {
        const instance = await getUserInstanceById(context.userId, instanceId);
        if (!instance) {
          return JSON.stringify({ error: "Instance not found." });
        }
        instanceName = instance.name;
      }

      const credential = await getSshCredential(context.userId, instanceId, "safe");
      if (!credential) {
        return JSON.stringify({
          error:
            "No SSH credentials saved for this instance. Direct the user to save them at [SSH Terminal](/dashboard/vps/terminal) — render that as a clickable Markdown link, not inline code.",
        });
      }

      return JSON.stringify({
        ok: true,
        instance_id: instanceId,
        instance_name: instanceName,
        message:
          "Terminal opened in the chat UI. Use terminal_run to propose commands for the user to approve.",
      });
    }

    if (name === "terminal_run") {
      const command =
        typeof args.command === "string" ? args.command.trim() : "";
      const reason =
        typeof args.reason === "string" ? args.reason.trim() : "";
      if (!command) return JSON.stringify({ error: "Missing command" });
      if (!context.callId) {
        return JSON.stringify({ error: "Internal error: missing callId" });
      }

      const approved = await requestApproval(
        context.callId,
        context.abortSignal,
      );

      return JSON.stringify({
        ok: approved,
        approved,
        command,
        reason: reason || undefined,
        note: approved
          ? "User approved. The command has been injected into the terminal."
          : "User denied or the request timed out. Command was not executed.",
      });
    }

    if (name === "image_generate") {
      const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
      if (!prompt) return JSON.stringify({ error: "Missing prompt" });
      const size = resolveSize(args);
      const result = await runAndPersist({
        context,
        prompt,
        options: { prompt, size, abortSignal: context.abortSignal },
      });
      return JSON.stringify(result);
    }

    if (name === "image_edit") {
      const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
      const imageUrl =
        typeof args.image_url === "string" ? args.image_url.trim() : "";
      if (!prompt) return JSON.stringify({ error: "Missing prompt" });
      if (!imageUrl) return JSON.stringify({ error: "Missing image_url" });
      const validation = await validatePublicHttpUrl(imageUrl);
      if (!validation.ok) {
        return JSON.stringify({ error: validation.error });
      }
      const size = resolveSize(args);
      const result = await runAndPersist({
        context,
        prompt,
        options: {
          prompt,
          size,
          image: imageUrl,
          abortSignal: context.abortSignal,
        },
      });
      return JSON.stringify(result);
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    return JSON.stringify({ error: message });
  }
}

/**
 * Resolves the canonical OpenAI-style `size` string from a tool call's args.
 * Prefers `aspect_ratio` (preset) over the legacy free-form `size`.
 */
function resolveSize(args: Record<string, unknown>): string | undefined {
  const aspect = typeof args.aspect_ratio === "string" ? args.aspect_ratio.trim() : "";
  if (aspect) {
    return presetToSize(normalizeAspectInput(aspect));
  }
  const size = typeof args.size === "string" ? args.size.trim() : "";
  if (size) {
    return presetToSize(normalizeAspectInput(size));
  }
  return undefined;
}

/**
 * Runs the image generator and, when the tool was invoked with a Supabase
 * context, also records the result in `generated_image` so it shows up in the
 * gallery and the standalone /dashboard/image workspace. If we don't have a
 * Supabase client (older callers), we fall back to a plain generation.
 */
async function runAndPersist(args: {
  context: ToolContext;
  prompt: string;
  options: Parameters<typeof generateImage>[0];
}): Promise<{ url: string; prompt: string }> {
  const { context, prompt, options } = args;
  if (context.supabase) {
    const row = await generateAndRecord({
      supabase: context.supabase,
      userId: context.userId,
      prompt,
      conversationId: context.conversationId ?? null,
      source: "chat",
      options,
    });
    return { url: row.url, prompt: row.prompt };
  }
  return generateImage(options);
}

function getCurrentTime(timezone: string) {
  const now = new Date();
  let local: string;
  let resolvedTz = timezone;
  try {
    local = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "long",
    }).format(now);
  } catch {
    resolvedTz = "UTC";
    local = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      dateStyle: "full",
      timeStyle: "long",
    }).format(now);
  }
  return {
    iso_utc: now.toISOString(),
    epoch_ms: now.getTime(),
    timezone: resolvedTz,
    local,
  };
}

type InstanceLike = {
  id: string;
  external_instance_id: string;
  name: string;
  region: string;
  zone: string | null;
  provider_status?: string;
  status?: string;
  ip_public: string | null;
  ip_private: string | null;
  cpu: number | null;
  memory_gb: number | null;
  system_disk_gb: number | null;
  bandwidth_mbps: number | null;
  os_name: string | null;
  expires_at: string | null;
  last_synced_at: string | null;
};

function serializeInstanceForTool(instance: InstanceLike) {
  return {
    id: instance.id,
    external_instance_id: instance.external_instance_id,
    name: instance.name,
    status: instance.provider_status ?? instance.status ?? "UNKNOWN",
    region: instance.region,
    zone: instance.zone,
    ip_public: instance.ip_public,
    ip_private: instance.ip_private,
    cpu: instance.cpu,
    memory_gb: instance.memory_gb,
    system_disk_gb: instance.system_disk_gb,
    bandwidth_mbps: instance.bandwidth_mbps,
    os_name: instance.os_name,
    expires_at: instance.expires_at,
    last_synced_at: instance.last_synced_at,
  };
}
