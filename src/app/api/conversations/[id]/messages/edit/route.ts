import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { openai } from "@/lib/openai";
import { CHAT_SYSTEM_PROMPT } from "@/lib/server/chat-prompt";
import {
  appendMessage,
  editUserMessageAndTruncate,
  getConversation,
  getMessages,
  updateConversation,
} from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  messageId: z.string().min(1),
  content: z.string().min(1).max(20_000),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/conversations/:id/messages/edit
 *
 * Edits an existing user message and re-streams a new assistant reply. Any
 * messages that came after the edited one are dropped so the conversation
 * branches cleanly from this point.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let conversation, history, stream;
  try {
    conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const edited = await editUserMessageAndTruncate(supabase, {
      conversationId,
      userId: user.id,
      messageId: parsed.data.messageId,
      content: parsed.data.content,
    });
    if (!edited) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 },
      );
    }

    history = await getMessages(supabase, conversationId, user.id);
    if (history.length === 0) {
      return NextResponse.json(
        { error: "Nothing to send" },
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
      "[/api/conversations/[id]/messages/edit] setup failed:",
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
