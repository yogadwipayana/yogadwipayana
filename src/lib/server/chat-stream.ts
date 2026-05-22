import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";

import { openai } from "@/lib/openai";
import { CHAT_TOOLS, executeTool } from "@/lib/server/chat-tools";
import {
  appendMessage,
  updateConversation,
} from "@/lib/server/chat-service";

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MAX_TOOL_ROUNDS = 5;

type ToolCallAccumulator = {
  id: string;
  name: string;
  arguments: string;
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
  /** Optional AbortSignal — aborts the OpenAI stream when the client disconnects. */
  abortSignal?: AbortSignal;
}): Response {
  const {
    supabase,
    conversationId,
    userId,
    model,
    messages: initialMessages,
    preface,
    abortSignal,
  } = args;

  const encoder = new TextEncoder();
  const messages: ChatMessage[] = [...initialMessages];
  let finalAssistantText = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          // Client disconnected; silently ignore — generation continues in the
          // background and the result is still persisted via persistFinal().
        }
      };
      const sendDone = () => {
        try {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch {
          // ignore
        }
      };
      const closeStream = () => {
        try {
          controller.close();
        } catch {
          // Already closed; ignore.
        }
      };

      const persistFinal = async () => {
        if (finalAssistantText.length > 0) {
          try {
            const saved = await appendMessage(supabase, {
              conversationId,
              userId,
              role: "assistant",
              content: finalAssistantText,
            });
            send({ saved: { role: "assistant", id: saved.id } });
          } catch {
            // Persisting is best-effort; the stream itself should still close cleanly.
          }
        } else {
          // Bump updated_at even if the model returned nothing so the
          // conversation moves to the top of the list.
          try {
            await updateConversation(supabase, conversationId, userId, {});
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

      try {
        if (preface) send(preface);

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
              temperature: 0.7,
              stream: true,
              stream_options: { include_usage: true },
              tools: CHAT_TOOLS,
              tool_choice: "auto",
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
            await persistFinal();
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
            send({
              tool: {
                name: call.name,
                status: "running",
                call_id: call.id,
                args: tryParseJson(call.arguments || "{}"),
              },
            });
            const result = await executeTool(call.name, call.arguments, {
              userId,
              conversationId,
              supabase,
              abortSignal,
              callId: call.id,
            });
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
                result: tryParseJson(result),
              },
            });
          }

          // Reset the round-local text. We only persist the final round's
          // assistant content (after no more tool calls).
          finalAssistantText = "";
        }

        // Tool-call loop budget exhausted. Emit a graceful note and close.
        const note =
          "(Stopped after reaching the tool-call limit. Ask me to continue if you need more.)";
        send({ delta: note });
        finalAssistantText = note;
        await persistFinal();
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
            });
            send({ saved: { role: "assistant", id: saved.id } });
          } catch {}
        }
        const message = err instanceof Error ? err.message : "stream error";
        send({ error: message });
        closeStream();
      }
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
