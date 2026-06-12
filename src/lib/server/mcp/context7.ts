import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type OpenAI from "openai";

/**
 * Bridge between the chat AI's OpenAI tool-calling loop and the remote Context7
 * MCP server (https://mcp.context7.com/mcp).
 *
 * Context7 exposes read-only documentation tools (resolve-library-id,
 * query-docs). We connect as an MCP client, list its tools, and expose them to
 * the model as ordinary OpenAI function tools under an `mcp__context7__`
 * namespace so they can't collide with the built-in tools and can be routed
 * back here for execution.
 *
 * The connection is created per chat request and closed when the tool loop
 * finishes, which suits serverless routes (no warm pool to maintain).
 */

const CONTEXT7_URL = "https://mcp.context7.com/mcp";
const TOOL_PREFIX = "mcp__context7__";

type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

/** A live MCP session plus its discovered, OpenAI-shaped tool list. */
export type Context7Session = {
  client: Client;
  tools: ChatTool[];
  close: () => Promise<void>;
};

/** True when an MCP tool name belongs to this bridge. */
export function isContext7Tool(name: string): boolean {
  return name.startsWith(TOOL_PREFIX);
}

/**
 * Connects to the Context7 MCP server and returns a session whose `tools` are
 * ready to merge into the OpenAI `tools` array. Returns null (never throws) if
 * the connection or discovery fails, so a Context7 outage degrades gracefully
 * to the built-in tools instead of breaking the whole chat.
 */
export async function openContext7Session(): Promise<Context7Session | null> {
  const apiKey = process.env.CONTEXT7_API_KEY;

  const transport = new StreamableHTTPClientTransport(new URL(CONTEXT7_URL), {
    requestInit: {
      // Context7's MCP endpoint authenticates with a custom header (not
      // Authorization: Bearer). Without a key it still works at a lower rate
      // limit, so the header is only sent when configured.
      headers: apiKey ? { CONTEXT7_API_KEY: apiKey } : {},
    },
  });

  const client = new Client({
    name: "yogadwipayana-chat",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const chatTools = tools.map(toChatTool);
    return {
      client,
      tools: chatTools,
      close: async () => {
        try {
          await client.close();
        } catch {
          // best-effort
        }
      },
    };
  } catch {
    try {
      await client.close();
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Calls a Context7 MCP tool by its namespaced name and returns a JSON string
 * suitable for use as an OpenAI `tool` message's content. Errors are returned
 * as `{ "error": "..." }` rather than thrown, matching `executeTool`'s
 * convention so a tool failure surfaces to the model without aborting the
 * chat stream.
 */
export async function callContext7Tool(
  client: Client,
  namespacedName: string,
  argsJson: string,
): Promise<string> {
  const realName = namespacedName.slice(TOOL_PREFIX.length);

  let args: Record<string, unknown>;
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return JSON.stringify({ error: "Invalid JSON arguments" });
  }

  try {
    const result = await client.callTool({ name: realName, arguments: args });
    const text = flattenContent(result.content);
    if (result.isError) {
      return JSON.stringify({ error: text || "MCP tool returned an error" });
    }
    return text || JSON.stringify({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "MCP tool call failed";
    return JSON.stringify({ error: message });
  }
}

/** Convert one MCP tool descriptor into an OpenAI function tool. */
function toChatTool(tool: {
  name: string;
  description?: string;
  inputSchema: { type: "object"; [k: string]: unknown };
}): ChatTool {
  return {
    type: "function",
    function: {
      name: `${TOOL_PREFIX}${tool.name}`,
      description: tool.description ?? "",
      // Context7's inputSchema is already valid JSON Schema with an object
      // root, which is exactly what OpenAI's `parameters` expects.
      parameters: tool.inputSchema as Record<string, unknown>,
    },
  };
}

/**
 * MCP tool results are an array of typed content blocks. The model only needs
 * text, so concatenate text blocks and describe non-text blocks compactly.
 * Accepts `unknown` because `callTool`'s return is a union (the `content`
 * branch vs. a legacy `toolResult` branch).
 */
function flattenContent(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  return content
    .map((block) => {
      if (
        block &&
        typeof block === "object" &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        return (block as { text: string }).text;
      }
      const type =
        block && typeof block === "object"
          ? String((block as { type?: unknown }).type ?? "unknown")
          : "unknown";
      return `[${type} content omitted]`;
    })
    .join("\n")
    .trim();
}
