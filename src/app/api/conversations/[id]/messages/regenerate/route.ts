import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CHAT_SYSTEM_PROMPT, IMAGE_MODE_SYSTEM_PROMPT, buildCustomSystemPromptBlock, composeSystemMessage } from "@/lib/server/chat-prompt";
import {
  applyHistoryWindow,
  deleteLastAssistantMessage,
  getConversation,
  getMessages,
} from "@/lib/server/chat-service";
import { fail } from "@/lib/server/api-response";
import {
  buildMemoryReminder,
  buildMemorySystemBlock,
  listActiveMemories,
} from "@/lib/server/memory-service";
import { runChatStream } from "@/lib/server/chat-stream";
import { stopAndWait } from "@/lib/server/chat-registry";
import { getConversationSystemPromptContent } from "@/lib/server/system-prompt-service";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { parseSlash, slashSystemPrompt, slashRewriteUserContent } from "@/lib/server/slash-commands";
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

    // Tear down any in-flight generation for this conversation and wait for it
    // to persist its partial turn BEFORE mutating history. Without this, a stale
    // generation could write a stale assistant message after the delete below.
    await stopAndWait(conversationId);

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

    // Custom system prompt attached to this conversation (if any).
    const customSystemPrompt = await getConversationSystemPromptContent(
      supabase,
      conversationId,
      user.id,
    );

    // Active long-term memory — same injection as the send route so regenerate
    // keeps honoring the user's standing preferences.
    const activeMemories = await listActiveMemories(supabase, user.id);
    const memoryBlock = buildMemorySystemBlock(activeMemories);
    const memoryReminder = buildMemoryReminder(activeMemories);

    // For tool-backed slash commands (/word), reframe the last user turn sent
    // to the model so it triggers the tool under tool_choice:"auto". The DB
    // copy keeps the original `/word …` text.
    const rewritten = slashParsed ? slashRewriteUserContent(slashParsed) : null;
    const lastUserId = rewritten ? lastUserMessage?.id : undefined;

    const messagesForModel = [
      {
        role: "system" as const,
        content: composeSystemMessage([
          CHAT_SYSTEM_PROMPT,
          memoryBlock,
          conversation.mode === "image" ? IMAGE_MODE_SYSTEM_PROMPT : null,
          slashParsed ? slashSystemPrompt(slashParsed) : null,
          customSystemPrompt
            ? buildCustomSystemPromptBlock(customSystemPrompt)
            : null,
        ]),
      },
      ...applyHistoryWindow(
        history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: rewritten && m.id === lastUserId ? rewritten : m.content,
        })),
      ),
      // Restate memory after the history so recency beats prior-turn language
      // momentum (history here ends with the user turn being regenerated).
      ...(memoryReminder
        ? [{ role: "system" as const, content: memoryReminder }]
        : []),
    ];

    return runChatStream({
      supabase,
      conversationId,
      userId: user.id,
      model: conversation.model,
      messages: messagesForModel,
    });
  } catch (err) {
    return fail(err);
  }
}
