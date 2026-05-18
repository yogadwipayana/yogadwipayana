import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { openai } from "@/lib/openai";
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

  let conversation, priorMessages, stream;
  try {
    conversation = await getConversation(supabase, conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    priorMessages = await getMessages(supabase, conversationId);

    await appendMessage(supabase, {
      conversationId,
      role: "user",
      content: parsed.data.content,
    });

    if (priorMessages.length === 0) {
      await updateConversation(supabase, conversationId, {
        title: deriveTitle(parsed.data.content),
      });
    }

    const messagesForModel = [
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
          await appendMessage(supabase, {
            conversationId,
            role: "assistant",
            content: assistantText,
          });
        } else {
          // Bump updated_at even if the model returned nothing so the
          // conversation moves to the top of the list.
          await updateConversation(supabase, conversationId, {});
        }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
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
