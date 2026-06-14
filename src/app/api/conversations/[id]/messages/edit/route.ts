import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { CHAT_SYSTEM_PROMPT, IMAGE_MODE_SYSTEM_PROMPT, buildCustomSystemPromptBlock, composeSystemMessage } from "@/lib/server/chat-prompt";
import {
  applyHistoryWindow,
  editUserMessageAndTruncate,
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
import {
  buildAttachmentFooter,
  buildUserContentWithAttachments,
  validateAttachmentUrl,
  type Attachment,
} from "@/lib/server/vision";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const AttachmentSchema = z.object({
  kind: z.enum(["image", "pdf", "document"]),
  url: z.string().url(),
  name: z.string().min(1).max(255),
  mime: z.string().min(1).max(127),
  size: z.number().int().positive().max(50 * 1024 * 1024),
});

const Body = z.object({
  messageId: z.string().min(1),
  content: z.string().min(1).max(20_000),
  attachments: z.array(AttachmentSchema).max(6).optional(),
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
    await checkRateLimit(
      ratelimits.chat,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "chat edit",
    );
    const conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { content, attachments } = parsed.data;

    // Custom system prompt attached to this conversation (if any).
    const customSystemPrompt = await getConversationSystemPromptContent(
      supabase,
      conversationId,
      user.id,
    );

    // Active long-term memory — same injection as the send route so edits keep
    // honoring the user's standing preferences.
    const activeMemories = await listActiveMemories(supabase, user.id);
    const memoryBlock = buildMemorySystemBlock(activeMemories);
    const memoryReminder = buildMemoryReminder(activeMemories);

    for (const att of attachments ?? []) {
      const validation = await validateAttachmentUrl(att.url);
      if (!validation.ok) {
        return NextResponse.json(
          { error: `Attachment URL rejected: ${validation.error}` },
          { status: 400 },
        );
      }
    }

    // Build the DB-persisted content: user text + optional attachment footer
    const footer = buildAttachmentFooter((attachments ?? []) as Attachment[]);
    const persistedContent = content + footer;

    // Tear down any in-flight generation and wait for it to persist before we
    // edit + truncate history, so a stale runner can't write after the branch.
    await stopAndWait(conversationId);

    const edited = await editUserMessageAndTruncate(supabase, {
      conversationId,
      userId: user.id,
      messageId: parsed.data.messageId,
      content: persistedContent,
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

    // Parse slash command (if any)
    const slashParsed = parseSlash(content);

    // For tool-backed slash commands (/word), reframe the text sent to the
    // model so it actually triggers the tool under tool_choice:"auto".
    const modelText =
      (slashParsed && slashRewriteUserContent(slashParsed)) ?? content;

    // Build the multipart content for the model's latest user turn
    const userContentForModel = await buildUserContentWithAttachments({
      text: modelText,
      attachments: (attachments ?? []) as Attachment[],
    });

    // Replace the last history entry's content with the multipart version
    // (the edited message is always the last in history after truncation)
    const historyForModel = applyHistoryWindow(
      history.slice(0, -1).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    );

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
      ...historyForModel,
      ...(memoryReminder
        ? [{ role: "system" as const, content: memoryReminder }]
        : []),
      { role: "user" as const, content: userContentForModel },
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
