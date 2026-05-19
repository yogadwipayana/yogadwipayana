import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { openai } from "@/lib/openai";
import { CHAT_SYSTEM_PROMPT } from "@/lib/server/chat-prompt";
import {
  appendMessage,
  deleteLastAssistantMessage,
  getConversation,
  getMessages,
  updateConversation,
} from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/conversations/:id/messages/regenerate
 *
 * Drops the most recent assistant message (if any) and re-streams a new
 * completion using the conversation's existing user-side history. Useful for
 * "try that again" after a bad answer or a stream error.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  let conversation, history, stream;
  try {
    conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Drop trailing assistant turn (if present) so the model regenerates from
    // the prior user message. If the last message is a user message, just
    // re-run the completion against the existing history.
    await deleteLastAssistantMessage(supabase, conversationId, user.id);

    history = await getMessages(supabase, conversationId, user.id);
    if (history.length === 0) {
      return NextResponse.json(
        { error: "Nothing to regenerate" },
        { status: 400 },
      );
    }

    const messagesForModel = [
      { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    stream = await openai().chat.completions.create({
      model: conversation.model,
      temperature: 0.7,
      stream: true,
      messages: messagesForModel,
    });
  } catch (err) {
    console.error(
      "[/api/conversations/[id]/messages/regenerate] setup failed:",
      err,
    );
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  let assistantText = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            assistantText += delta;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
            );
          }
        }

        if (assistantText.length > 0) {
          const savedAssistant = await appendMessage(supabase, {
            conversationId,
            userId: user.id,
            role: "assistant",
            content: assistantText,
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ saved: { role: "assistant", id: savedAssistant.id } })}\n\n`,
            ),
          );
        } else {
          await updateConversation(supabase, conversationId, user.id, {});
        }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        // Persist whatever streamed before the error so refreshes don't lose
        // the partial reply.
        if (assistantText.length > 0) {
          try {
            const savedAssistant = await appendMessage(supabase, {
              conversationId,
              userId: user.id,
              role: "assistant",
              content: assistantText,
            });
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ saved: { role: "assistant", id: savedAssistant.id } })}\n\n`,
              ),
            );
          } catch {}
        }
        const message = err instanceof Error ? err.message : "stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
        );
        controller.close();
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
