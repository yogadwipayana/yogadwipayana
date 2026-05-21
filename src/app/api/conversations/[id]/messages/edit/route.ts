import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { CHAT_SYSTEM_PROMPT, IMAGE_MODE_SYSTEM_PROMPT } from "@/lib/server/chat-prompt";
import {
  editUserMessageAndTruncate,
  getConversation,
  getMessages,
} from "@/lib/server/chat-service";
import { runChatStream } from "@/lib/server/chat-stream";
import { parseSlash, slashSystemPrompt } from "@/lib/server/slash-commands";
import {
  buildAttachmentFooter,
  buildUserContentWithAttachments,
  type Attachment,
} from "@/lib/server/vision";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const AttachmentSchema = z.object({
  kind: z.enum(["image", "pdf"]),
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
    const conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { content, attachments } = parsed.data;

    // Build the DB-persisted content: user text + optional attachment footer
    const footer = buildAttachmentFooter((attachments ?? []) as Attachment[]);
    const persistedContent = content + footer;

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

    // Build the multipart content for the model's latest user turn
    const userContentForModel = await buildUserContentWithAttachments({
      text: content,
      attachments: (attachments ?? []) as Attachment[],
    });

    // Parse slash command (if any)
    const slashParsed = parseSlash(content);

    // Replace the last history entry's content with the multipart version
    // (the edited message is always the last in history after truncation)
    const historyForModel = history.slice(0, -1).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const messagesForModel = [
      { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
      ...(conversation.mode === "image"
        ? [{ role: "system" as const, content: IMAGE_MODE_SYSTEM_PROMPT }]
        : []),
      ...(slashParsed
        ? [{ role: "system" as const, content: slashSystemPrompt(slashParsed) }]
        : []),
      ...historyForModel,
      { role: "user" as const, content: userContentForModel },
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
    console.error(
      "[/api/conversations/[id]/messages/edit] setup failed:",
      err,
    );
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
