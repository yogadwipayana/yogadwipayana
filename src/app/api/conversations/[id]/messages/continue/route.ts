import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CHAT_SYSTEM_PROMPT, IMAGE_MODE_SYSTEM_PROMPT, buildCustomSystemPromptBlock, composeSystemMessage } from "@/lib/server/chat-prompt";
import {
  applyHistoryWindow,
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
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const CONTINUE_INSTRUCTION =
  "Continue from where you left off. Your previous turn was cut short when it " +
  "reached the tool-call limit. Pick up exactly where you stopped, complete the " +
  "remaining work, and do not repeat what you already said.";

/**
 * POST /api/conversations/:id/messages/continue
 *
 * Resumes a turn that was cut off at the tool-call budget (the assistant's last
 * message has stopped_reason = "tool_budget"). Unlike regenerate, this does NOT
 * delete the prior assistant turn — it leaves it in history and streams a NEW
 * assistant message that continues the work. The fresh tool-round budget lets
 * the model keep going past the original limit.
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
      "chat continue",
    );
    const conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Wait for any in-flight generation to settle so history is stable before we
    // read it. Unlike regenerate, we do NOT delete the trailing assistant turn —
    // continuation builds on top of it.
    await stopAndWait(conversationId);

    const history = await getMessages(supabase, conversationId, user.id);
    const last = history[history.length - 1];
    if (!last || last.role !== "assistant") {
      return NextResponse.json(
        { error: "Nothing to continue" },
        { status: 400 },
      );
    }

    const customSystemPrompt = await getConversationSystemPromptContent(
      supabase,
      conversationId,
      user.id,
    );

    const activeMemories = await listActiveMemories(supabase, user.id);
    const memoryBlock = buildMemorySystemBlock(activeMemories);
    const memoryReminder = buildMemoryReminder(activeMemories);

    const messagesForModel = [
      {
        role: "system" as const,
        content: composeSystemMessage([
          CHAT_SYSTEM_PROMPT,
          memoryBlock,
          conversation.mode === "image" ? IMAGE_MODE_SYSTEM_PROMPT : null,
          customSystemPrompt
            ? buildCustomSystemPromptBlock(customSystemPrompt)
            : null,
        ]),
      },
      ...applyHistoryWindow(
        history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ),
      ...(memoryReminder
        ? [{ role: "system" as const, content: memoryReminder }]
        : []),
      // A synthetic user turn telling the model to resume. History ends with the
      // (cut-off) assistant turn, so this both makes the request well-formed and
      // gives the model an explicit instruction to keep going.
      { role: "user" as const, content: CONTINUE_INSTRUCTION },
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
