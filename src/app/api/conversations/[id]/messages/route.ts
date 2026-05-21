import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { CHAT_SYSTEM_PROMPT, IMAGE_MODE_SYSTEM_PROMPT } from "@/lib/server/chat-prompt";
import {
  appendMessage,
  deriveTitle,
  getConversation,
  getMessages,
  updateConversation,
} from "@/lib/server/chat-service";
import { runChatStream } from "@/lib/server/chat-stream";
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

  try {
    const conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const priorMessages = await getMessages(supabase, conversationId, user.id);

    const savedUserMessage = await appendMessage(supabase, {
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
      ...(conversation.mode === "image"
        ? [{ role: "system" as const, content: IMAGE_MODE_SYSTEM_PROMPT }]
        : []),
      ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: parsed.data.content },
    ];

    return runChatStream({
      supabase,
      conversationId,
      userId: user.id,
      model: conversation.model,
      messages: messagesForModel,
      preface: { saved: { role: "user", id: savedUserMessage.id } },
    });
  } catch (err) {
    console.error("[/api/conversations/[id]/messages] setup failed:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
