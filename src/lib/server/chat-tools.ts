import type OpenAI from "openai";

import {
  getInstanceDetail,
  listUserInstances,
} from "@/lib/server/dashboard-service";

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
];

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_BYTES = 8_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; YogadwipayanaChat/1.0; +https://yogadwipayana.com)";

type SearchResult = { title: string; url: string; snippet: string };

async function tavilySearch(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Tavily HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (json.results ?? [])
    .filter((r) => r.url)
    .slice(0, maxResults)
    .map((r) => ({
      title: r.title ?? r.url ?? "",
      url: r.url ?? "",
      snippet: r.content ?? "",
    }));
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

function unwrapDdgRedirect(href: string): string {
  // DDG HTML wraps result links in /l/?uddg=<encoded-url>&...
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return url.toString();
  } catch {
    return href;
  }
}

async function duckDuckGoSearch(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const res = await fetch(
    `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    throw new Error(`DuckDuckGo HTML HTTP ${res.status}`);
  }
  const html = await res.text();

  const results: SearchResult[] = [];
  // Each result block contains an <a class="result__a" href="..."> followed by
  // an <a class="result__snippet">snippet</a> a few tags later.
  const blockRe =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(html)) !== null) {
    const url = unwrapDdgRedirect(decodeHtmlEntities(match[1]));
    if (!/^https?:\/\//i.test(url)) continue;
    results.push({
      title: stripTags(match[2]),
      url,
      snippet: stripTags(match[3]),
    });
    if (results.length >= maxResults) break;
  }
  return results;
}

async function webSearch(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    return tavilySearch(query, maxResults, tavilyKey);
  }
  return duckDuckGoSearch(query, maxResults);
}

type FetchResult = { url: string; title: string; text: string; truncated: boolean };

async function webFetch(rawUrl: string): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }

  const res = await fetch(parsed.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  let title = parsed.toString();
  let text: string;
  if (contentType.includes("html") || /^\s*</.test(raw)) {
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) title = stripTags(titleMatch[1]).slice(0, 200) || title;
    text = raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
    text = stripTags(text).replace(/\s+/g, " ").trim();
  } else {
    text = raw.replace(/\s+/g, " ").trim();
  }

  const truncated = text.length > MAX_TEXT_BYTES;
  if (truncated) text = text.slice(0, MAX_TEXT_BYTES);

  return { url: parsed.toString(), title, text, truncated };
}

/**
 * Dispatches a tool call by name. Always returns a JSON string suitable for use
 * as a `tool` message's `content`. Errors are returned as `{ "error": "..." }`
 * so a tool failure surfaces to the model without aborting the chat stream.
 */
export type ToolContext = {
  /** Authenticated Supabase user id. Required for tools that touch user data. */
  userId: string;
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

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    return JSON.stringify({ error: message });
  }
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
