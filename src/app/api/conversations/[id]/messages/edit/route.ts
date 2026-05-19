import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { CHAT_SYSTEM_PROMPT } from "@/lib/server/chat-prompt";
import {
  editUserMessageAndTruncate,
  getConversation,
  getMessages,
} from "@/lib/server/chat-service";
import { runChatStream } from "@/lib/server/chat-stream";
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

  try {
    const conversation = await getConversation(supabase, conversationId, user.id);
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

    const history = await getMessages(supabase, conversationId, user.id);
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

    return runChatStream({
      supabase,
      conversationId,
      userId: user.id,
      model: conversation.model,
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
}
