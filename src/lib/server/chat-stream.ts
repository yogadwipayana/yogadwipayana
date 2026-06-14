import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";

import { openai } from "@/lib/openai";
import { executeTool, getChatTools, isToolDisabled } from "@/lib/server/chat-tools";
import {
  openContext7Session,
  type Context7Session,
} from "@/lib/server/mcp/context7";
import {
  appendMessage,
  getConversation,
  recordUsageEvent,
  touchConversation,
} from "@/lib/server/chat-service";
import {
  startGeneration,
  type Frame,
  type Generation,
} from "@/lib/server/chat-registry";

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MAX_TOOL_ROUNDS = 50;

/**
 * Patterns for questions whose correct answer drifts over time — install/setup
 * commands, package repos, versions, prices, "latest/today/current". When the
 * most recent user message matches, we force a `web_search` on the first round
 * instead of trusting `tool_choice: "auto"` (which lets the model answer from
 * stale memory). English + Bahasa Indonesia, since the app supports both.
 */
const GROUNDING_PATTERN =
  /\b(install|installation|set\s?up|setup|configure|configuration|deploy|upgrade|migrat|latest|newest|current|recent|today|version|release|price|cost|pricing)\b|cara\s+(install|memasang|setup|pasang)|terbaru|terkini|sekarang|versi|harga|rilis/i;

// Recognized code libraries / frameworks / SDKs that Context7 indexes well.
// Kept conservative on purpose: OS/CLI tooling (docker, nginx, apt, systemd) is
// deliberately excluded so those installs still route to web_search.
const LIBRARY_DOCS_PATTERN =
  /\b(next\.?js|react|react\s?native|vue|nuxt|svelte|sveltekit|angular|solid\.?js|astro|remix|prisma|drizzle|sequelize|typeorm|mongoose|supabase|firebase|tailwind(?:css)?|shadcn|radix|mui|chakra|express|fastify|nest\.?js|hono|django|flask|fastapi|laravel|rails|spring(?:\s?boot)?|tanstack|react\s?query|redux|zustand|zod|stripe|clerk|auth\.?js|nextauth|langchain|openai\s?sdk|vercel\s?ai\s?sdk|ai\s?sdk|pandas|numpy|pytorch|tensorflow|playwright|cypress|vitest|jest|webpack|vite|rollup|esbuild|axios|graphql|apollo|trpc)\b/i;

/** Extracts plain text from a chat message whose content may be a string or parts array. */
function messageText(message: ChatMessage): string {
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join(" ");
  }
  return "";
}

/** True when the last user message looks like a question that needs live grounding. */
function lastUserNeedsGrounding(messages: ChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      return GROUNDING_PATTERN.test(messageText(messages[i]));
    }
  }
  return false;
}

/** True when the last user message names a code library/framework/SDK Context7 covers. */
function lastUserNeedsLibraryDocs(messages: ChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      return LIBRARY_DOCS_PATTERN.test(messageText(messages[i]));
    }
  }
  return false;
}

type ToolCallAccumulator = {
  id: string;
  name: string;
  arguments: string;
};

type PersistedToolEvent = {
  call_id: string;
  name: string;
  status: "done";
  args?: unknown;
  result?: unknown;
};

type SsePreface = Record<string, unknown>;

/**
 * Shared chat streaming pipeline used by send / edit / regenerate routes.
 *
 * Runs an OpenAI tool-calling loop: each round streams `delta.content` to the
 * client as `data: {"delta": "..."}` SSE frames, accumulates any tool calls,
 * executes them server-side, and feeds the results back to the model. Only the
 * final assistant turn is persisted to the database.
 */
export function runChatStream(args: {
  supabase: SupabaseClient;
  conversationId: string;
  userId: string;
  model: string;
  messages: ChatMessage[];
  /** Optional frame emitted before any model output (e.g. saved user id). */
  preface?: SsePreface;
}): Response {
  // Start the generation in the registry — or attach to one already running for
  // this conversation. The generation is owned by the server process, not this
  // request, so it keeps running and persisting even if the client disconnects.
  const gen = startGeneration(args.conversationId, (push, signal) =>
    runGeneration({
      supabase: args.supabase,
      conversationId: args.conversationId,
      userId: args.userId,
      model: args.model,
      messages: args.messages,
      preface: args.preface,
      push,
      signal,
    }),
  );
  return streamResponse(gen);
}

/**
 * Build an SSE Response that first replays every frame buffered for a
 * generation, then streams live frames as they arrive. Any number of clients
 * can call this for the same generation (the original sender plus reconnecting
 * tabs after a refresh or navigation).
 */
export function streamResponse(gen: Generation): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (frame: Frame) => {
        if (closed) return;
        try {
          if ((frame as { __done?: true }).__done) {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            closed = true;
            try {
              controller.close();
            } catch {
              // already closed
            }
            return;
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
          );
        } catch {
          // This subscriber's controller is gone (client disconnected); ignore.
          // The generation itself is unaffected.
        }
      };

      // Replay the backlog. There is no `await` between snapshotting the buffer
      // and subscribing, so the runner (a separate async task) cannot push in
      // between — no frame is missed or double-delivered.
      const backlog = gen.buffer.slice();
      for (const frame of backlog) write(frame);

      if (closed) return; // backlog already contained the done sentinel
      if (gen.done) {
        try {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch {}
        try {
          controller.close();
        } catch {}
        return;
      }

      const unsub = gen.subscribe((frame) => {
        write(frame);
        if (closed) unsub();
      });
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * The OpenAI tool-calling loop, run as a registry generation. Pushes SSE frames
 * via `push`; aborts only when `signal` fires (explicit user stop, never client
 * disconnect). Resolves when the turn is fully done and the final assistant
 * message has been persisted. Each round streams `delta.content`, accumulates
 * tool calls, executes them server-side, and feeds results back to the model.
 */
async function runGeneration(ctx: {
  supabase: SupabaseClient;
  conversationId: string;
  userId: string;
  model: string;
  messages: ChatMessage[];
  preface?: SsePreface;
  push: (frame: Frame) => void;
  signal: AbortSignal;
}): Promise<void> {
  const {
    supabase,
    conversationId,
    userId,
    model,
    messages: initialMessages,
    preface,
    push,
    signal: abortSignal,
  } = ctx;

  const messages: ChatMessage[] = [...initialMessages];
  let finalAssistantText = "";
  // Text the model emitted in tool-executing rounds (before the final answer).
  // finalAssistantText is reset to "" after each tool round, so without this the
  // budget-limit path would lose everything the model said while working.
  let accumulatedRoundText = "";
  // Accumulate all tool call results across every round so they can be
  // persisted alongside the final assistant message.
  const allToolEvents: PersistedToolEvent[] = [];
  // Token usage from the model, summed across rounds (each tool-call round is a
  // separate completion with its own usage). Persisted with the final message.
  const usageTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let sawUsage = false;

  const send = (payload: Record<string, unknown>) => push(payload);
  // The DONE sentinel and stream close are owned by streamResponse (via the
  // registry's finish()), so these are no-ops now. Kept as named calls to keep
  // the loop body below unchanged.
  const sendDone = () => {};
  const closeStream = () => {};

      const persistFinal = async (followUps?: string[], stoppedReason?: string) => {
        if (finalAssistantText.length > 0) {
          try {
            const saved = await appendMessage(supabase, {
              conversationId,
              userId,
              role: "assistant",
              content: finalAssistantText,
              toolEvents: allToolEvents.length > 0 ? allToolEvents : undefined,
              followUps: followUps?.length ? followUps : undefined,
              usage: sawUsage ? usageTotals : undefined,
              stoppedReason,
            });
            send({ saved: { role: "assistant", id: saved.id } });
            // Append to the immutable usage ledger so consumption survives
            // conversation deletion. Independent best-effort write.
            if (sawUsage) {
              try {
                await recordUsageEvent(supabase, userId, {
                  model,
                  promptTokens: usageTotals.promptTokens,
                  completionTokens: usageTotals.completionTokens,
                  totalTokens: usageTotals.totalTokens,
                  toolCalls: allToolEvents.length,
                });
              } catch {
                // Ledger write is best-effort; never break the stream.
              }
            }
          } catch {
            // Persisting is best-effort; the stream itself should still close cleanly.
          }
        } else {
          // Bump updated_at even if the model returned nothing so the
          // conversation moves to the top of the list.
          try {
            await touchConversation(supabase, conversationId);
          } catch {}
        }
      };

      /** Safely parse JSON; returns the parsed value or the raw string. */
      const tryParseJson = (raw: string): unknown => {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      };

      /** Generate follow-up suggestions, persist with final message, and emit. */
      const persistAndSendFollowUps = async () => {
        if (abortSignal?.aborted) {
          await persistFinal();
          return;
        }
        let followUps: string[] = [];
        try {
          followUps = await generateFollowUps(messages, model);
        } catch {
          // best-effort
        }
        await persistFinal(followUps.length > 0 ? followUps : undefined);
        if (followUps.length > 0) send({ follow_ups: followUps });
      };

      let mcpSession: Context7Session | null = null;
      try {
        if (preface) send(preface);

        // Per-conversation tool toggles: load the disabled categories once so
        // the model never sees (and the forced-tool logic never forces) a tool
        // the user switched off for this conversation.
        let disabledTools: string[] = [];
        try {
          const conv = await getConversation(supabase, conversationId, userId);
          disabledTools = conv?.disabled_tools ?? [];
        } catch {
          // Best-effort; an empty list just means no tools are disabled.
        }

        // Connect to the Context7 MCP server for this turn. Best-effort: a null
        // session just means the model falls back to the built-in tools.
        mcpSession = await openContext7Session();

        // Questions about install/setup/versions/prices drift over time. Force a
        // web_search on the first round so the model grounds instead of answering
        // from stale memory; subsequent rounds revert to "auto".
        const forceSearchFirstRound =
          !isToolDisabled("web_search", disabledTools) &&
          lastUserNeedsGrounding(messages);
        // When Context7 is connected and the question names a known library/
        // framework/SDK, force its lookup on round 0. This takes priority over
        // forceSearchFirstRound so e.g. "install next.js latest" routes to
        // Context7 (library docs) instead of web_search (OS install).
        const forceContext7FirstRound =
          !isToolDisabled("mcp__context7__resolve-library-id", disabledTools) &&
          !!mcpSession &&
          mcpSession.tools.some(
            (t) =>
              t.type === "function" &&
              t.function.name === "mcp__context7__resolve-library-id",
          ) &&
          lastUserNeedsLibraryDocs(messages);

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          // Check abort before each round
          if (abortSignal?.aborted) {
            await persistFinal();
            sendDone();
            closeStream();
            return;
          }

          const stream = await openai().chat.completions.create(
            {
              model,
              temperature: 0.4,
              stream: true,
              stream_options: { include_usage: true },
              tools: getChatTools(mcpSession, disabledTools),
              tool_choice:
                round === 0 && forceContext7FirstRound
                  ? {
                      type: "function",
                      function: { name: "mcp__context7__resolve-library-id" },
                    }
                  : round === 0 && forceSearchFirstRound
                    ? { type: "function", function: { name: "web_search" } }
                    : "auto",
              messages,
            },
            { signal: abortSignal },
          );

          let roundText = "";
          const toolCalls = new Map<number, ToolCallAccumulator>();
          let finishReason: string | null = null;

          for await (const chunk of stream) {
            // Check abort mid-stream
            if (abortSignal?.aborted) break;

            // Emit usage if present (typically on the final chunk)
            if (chunk.usage) {
              sawUsage = true;
              usageTotals.promptTokens += chunk.usage.prompt_tokens ?? 0;
              usageTotals.completionTokens += chunk.usage.completion_tokens ?? 0;
              usageTotals.totalTokens += chunk.usage.total_tokens ?? 0;
              send({
                usage: {
                  prompt_tokens: chunk.usage.prompt_tokens,
                  completion_tokens: chunk.usage.completion_tokens,
                  total_tokens: chunk.usage.total_tokens,
                },
              });
            }

            const choice = chunk.choices[0];
            if (!choice) continue;
            const delta = choice.delta;

            if (typeof delta?.content === "string" && delta.content.length > 0) {
              roundText += delta.content;
              send({ delta: delta.content });
            }

            if (delta?.tool_calls) {
              for (const part of delta.tool_calls) {
                const idx = part.index ?? 0;
                const existing =
                  toolCalls.get(idx) ?? { id: "", name: "", arguments: "" };
                if (part.id) existing.id = part.id;
                if (part.function?.name) existing.name = part.function.name;
                if (part.function?.arguments)
                  existing.arguments += part.function.arguments;
                toolCalls.set(idx, existing);
              }
            }

            if (choice.finish_reason) finishReason = choice.finish_reason;
          }

          // If aborted mid-stream, persist what we have and close
          if (abortSignal?.aborted) {
            finalAssistantText = roundText || finalAssistantText;
            await persistFinal();
            sendDone();
            closeStream();
            return;
          }

          finalAssistantText = roundText;

          if (finishReason !== "tool_calls" || toolCalls.size === 0) {
            await persistAndSendFollowUps();
            sendDone();
            closeStream();
            return;
          }

          // Replay this round's assistant turn (including tool_calls) into the
          // message history so the next request is well-formed, then execute
          // each tool and append its result.
          const orderedCalls = [...toolCalls.entries()]
            .sort(([a], [b]) => a - b)
            .map(([, call]) => call);

          // ask_user is a terminal, NON-blocking action. Rather than parking
          // the stream waiting for an answer (which leaves the sidebar spinner
          // stuck and loses the card on reload), we persist the question as the
          // assistant turn and close the stream. The user's answer arrives as
          // the next user message (submitted from the question card), resuming
          // the conversation on a fresh turn with the question already in
          // history.
          const askCall = orderedCalls.find((c) => c.name === "ask_user");
          if (askCall) {
            const askArgs = tryParseJson(askCall.arguments || "{}");
            const question =
              askArgs && typeof askArgs === "object" && askArgs !== null
                ? String(
                    (askArgs as Record<string, unknown>).question ?? "",
                  ).trim()
                : "";
            const preamble = roundText.trim();
            // The question must be visible as assistant content so it reads
            // naturally in history and on reload. The card renders only the
            // answer controls (not the question text), so stream the question
            // delta when it isn't already part of the preamble to keep the
            // live view consistent with the persisted/reloaded view.
            const includesQuestion =
              question.length > 0 && preamble.includes(question);
            finalAssistantText = !preamble
              ? question || "I have a question for you."
              : includesQuestion
                ? preamble
                : `${preamble}\n\n${question}`;
            const extra = !preamble
              ? finalAssistantText.slice(roundText.length)
              : includesQuestion
                ? ""
                : `\n\n${question}`;
            if (extra) send({ delta: extra });
            send({
              tool: {
                name: "ask_user",
                status: "running",
                call_id: askCall.id,
                args: askArgs,
              },
            });
            allToolEvents.push({
              call_id: askCall.id,
              name: "ask_user",
              status: "done",
              args: askArgs,
              result: { question },
            });
            await persistFinal();
            sendDone();
            closeStream();
            return;
          }

          messages.push({
            role: "assistant",
            content: roundText || null,
            tool_calls: orderedCalls.map((c) => ({
              id: c.id,
              type: "function" as const,
              function: { name: c.name, arguments: c.arguments || "{}" },
            })),
          });

          for (const call of orderedCalls) {
            const parsedArgs = tryParseJson(call.arguments || "{}");
            send({
              tool: {
                name: call.name,
                status: "running",
                call_id: call.id,
                args: parsedArgs,
              },
            });
            const result = await executeTool(call.name, call.arguments, {
              userId,
              conversationId,
              supabase,
              abortSignal,
              callId: call.id,
              mcpSession,
            });
            const parsedResult = tryParseJson(result);
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: result,
            });
            send({
              tool: {
                name: call.name,
                status: "done",
                call_id: call.id,
                result: parsedResult,
              },
            });
            // Record the completed tool call so it can be persisted with the
            // final assistant message and restored on conversation reload.
            allToolEvents.push({
              call_id: call.id,
              name: call.name,
              status: "done",
              args: parsedArgs,
              result: parsedResult,
            });
          }

          // Reset the round-local text. We only persist the final round's
          // assistant content (after no more tool calls). Preserve what the
          // model said this round in the accumulator so the budget-limit path
          // can still surface it.
          if (roundText.trim().length > 0) {
            accumulatedRoundText += (accumulatedRoundText ? "\n\n" : "") + roundText;
          }
          finalAssistantText = "";
        }

        // Tool-call loop budget exhausted. Surface any work-in-progress text the
        // model emitted, append a note, persist with a marker, and emit a
        // `stopped` frame so the client can offer a Continue action.
        const note =
          "(Stopped after reaching the tool-call limit. Ask me to continue if you need more.)";
        send({ delta: note });
        finalAssistantText = accumulatedRoundText
          ? `${accumulatedRoundText}\n\n${note}`
          : note;
        await persistFinal(undefined, "tool_budget");
        send({ stopped: "tool_budget" });
        sendDone();
        closeStream();
      } catch (err) {
        if (finalAssistantText.length > 0) {
          try {
            const saved = await appendMessage(supabase, {
              conversationId,
              userId,
              role: "assistant",
              content: finalAssistantText,
              toolEvents: allToolEvents.length > 0 ? allToolEvents : undefined,
            });
            send({ saved: { role: "assistant", id: saved.id } });
          } catch {}
        }
        const message = err instanceof Error ? err.message : "stream error";
        send({ error: message });
        closeStream();
      } finally {
        // Always tear down the MCP session, whether the turn finished, errored,
        // or returned early (ask_user, abort, budget limit).
        if (mcpSession) await mcpSession.close();
      }
}

/**
 * Generate 4 follow-up question suggestions based on the conversation.
 * Uses the same model but a short, constrained prompt so it resolves quickly.
 */
async function generateFollowUps(
  messages: ChatMessage[],
  model: string,
): Promise<string[]> {
  const completion = await openai().chat.completions.create({
    model,
    temperature: 0.7,
    max_tokens: 256,
    messages: [
      ...messages,
      {
        role: "user",
        content:
          "Suggest 4 concise follow-up messages I (the user) might send next, based on our conversation. Write them in MY voice — as things I would say or ask YOU (the assistant), e.g. \"Reset my BTC wallet password\" or \"How do I recover my seed phrase?\". Do NOT write questions directed back at me (never \"Do you mean…?\", \"Are you trying to…?\", \"What platform are you using?\"). If your last reply asked me to clarify, turn each likely clarification into a statement I would send. Return ONLY a raw JSON array of strings — no markdown, no code block, no explanation. Example: [\"Message 1\", \"Message 2\", \"Message 3\", \"Message 4\"]",
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  // Strip accidental markdown fences
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed: unknown = JSON.parse(clean);
  if (Array.isArray(parsed)) {
    return (parsed as unknown[])
      .filter((q): q is string => typeof q === "string")
      .slice(0, 5);
  }
  return [];
}
