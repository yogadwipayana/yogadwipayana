import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CHAT_SYSTEM_PROMPT, IMAGE_MODE_SYSTEM_PROMPT } from "@/lib/server/chat-prompt";
import {
  deleteLastAssistantMessage,
  getConversation,
  getMessages,
} from "@/lib/server/chat-service";
import { fail } from "@/lib/server/api-response";
import { runChatStream } from "@/lib/server/chat-stream";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { parseSlash, slashSystemPrompt } from "@/lib/server/slash-commands";
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
export async function POST(request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  try {
    await checkRateLimit(
      ratelimits.chat,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "chat regenerate",
    );
    const conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Drop trailing assistant turn (if present) so the model regenerates from
    // the prior user message. If the last message is a user message, just
    // re-run the completion against the existing history.
    await deleteLastAssistantMessage(supabase, conversationId, user.id);

    const history = await getMessages(supabase, conversationId, user.id);
    if (history.length === 0) {
      return NextResponse.json(
        { error: "Nothing to regenerate" },
        { status: 400 },
      );
    }

    // Check the last user message for a slash command so the system prompt
    // is re-injected consistently on regenerate.
    const lastUserMessage = [...history].reverse().find((m) => m.role === "user");
    const slashParsed = lastUserMessage ? parseSlash(lastUserMessage.content) : null;

    const messagesForModel = [
      { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
      ...(conversation.mode === "image"
        ? [{ role: "system" as const, content: IMAGE_MODE_SYSTEM_PROMPT }]
        : []),
      ...(slashParsed
        ? [{ role: "system" as const, content: slashSystemPrompt(slashParsed) }]
        : []),
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    return runChatStream({
      supabase,
      conversationId,
      userId: user.id,
      model: conversation.model,
      messages: messagesForModel,
      abortSignal: request.signal,
    });
  } catch (err) {
    return fail(err);
  }
}
