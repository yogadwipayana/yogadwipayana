import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { openai } from "@/lib/openai";
import { CHAT_SYSTEM_PROMPT } from "@/lib/server/chat-prompt";
import {
  appendMessage,
  deriveTitle,
  getConversation,
  getMessages,
  updateConversation,
} from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  content: z.string().min(1).max(20_000),
});

type RouteContext = { params: Promise<{ id: string }> };

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

  let conversation, priorMessages, savedUserMessage, stream;
  try {
    conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    priorMessages = await getMessages(supabase, conversationId, user.id);

    savedUserMessage = await appendMessage(supabase, {
      conversationId,
      userId: user.id,
      role: "user",
      content: parsed.data.content,
    });

    if (priorMessages.length === 0) {
      await updateConversation(supabase, conversationId, user.id, {
        title: deriveTitle(parsed.data.content),
      });
    }

    const messagesForModel = [
      { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
      ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: parsed.data.content },
    ];

    stream = await openai().chat.completions.create({
      model: conversation.model,
      temperature: 0.7,
      stream: true,
      messages: messagesForModel,
    });
  } catch (err) {
    console.error("[/api/conversations/[id]/messages] setup failed:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  let assistantText = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Emit the persisted user message id first so the client can reconcile
        // its local placeholder with the DB row (needed for edit/delete on
        // freshly-sent messages).
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ saved: { role: "user", id: savedUserMessage.id } })}\n\n`,
          ),
        );

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
          // Bump updated_at even if the model returned nothing so the
          // conversation moves to the top of the list.
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
