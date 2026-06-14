import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { CHAT_SYSTEM_PROMPT, IMAGE_MODE_SYSTEM_PROMPT, buildCustomSystemPromptBlock, composeSystemMessage } from "@/lib/server/chat-prompt";
import {
  appendMessage,
  applyHistoryWindow,
  deriveTitle,
  getConversation,
  getMessages,
  updateConversation,
} from "@/lib/server/chat-service";
import { fail } from "@/lib/server/api-response";
import {
  buildMemoryReminder,
  buildMemorySystemBlock,
  listActiveMemories,
} from "@/lib/server/memory-service";
import { runChatStream } from "@/lib/server/chat-stream";
import { getConversationSystemPromptContent } from "@/lib/server/system-prompt-service";
import { resolveCustomSlashBlock } from "@/lib/server/custom-slash-command-service";
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

const Body = z
  .object({
    content: z.string().min(0).max(20_000),
    attachments: z.array(AttachmentSchema).max(6).optional(),
  })
  .refine((d) => d.content.trim().length > 0 || (d.attachments?.length ?? 0) > 0, {
    message: "Either content or at least one attachment is required",
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
    await checkRateLimit(
      ratelimits.chat,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "chat send",
    );
    const conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const priorMessages = await getMessages(supabase, conversationId, user.id);

    // Active long-term memory, injected into the system prompt so the assistant
    // honors the user's standing facts/preferences across every conversation.
    const activeMemories = await listActiveMemories(supabase, user.id);
    const memoryBlock = buildMemorySystemBlock(activeMemories);
    const memoryReminder = buildMemoryReminder(activeMemories);

    // Custom system prompt attached to this conversation (if any), injected
    // LAST in the system block (with override framing) so the user's
    // instructions take precedence over the base prompt's defaults.
    const customSystemPrompt = await getConversationSystemPromptContent(
      supabase,
      conversationId,
      user.id,
    );

    const { content, attachments } = parsed.data;

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

    const savedUserMessage = await appendMessage(supabase, {
      conversationId,
      userId: user.id,
      role: "user",
      content: persistedContent,
    });

    if (priorMessages.length === 0) {
      await updateConversation(supabase, conversationId, user.id, {
        title: deriveTitle(content),
      });
    }

    // Parse slash command (if any) — original content is kept in DB unchanged
    const slashParsed = parseSlash(content);

    // When no built-in command matched, fall back to a user-defined custom
    // slash command (built-ins always take precedence).
    const customSlashBlock = slashParsed
      ? null
      : await resolveCustomSlashBlock(supabase, user.id, content);

    // For tool-backed slash commands (/word), reframe the text sent to the
    // model so it actually triggers the tool under tool_choice:"auto".
    const modelText =
      (slashParsed && slashRewriteUserContent(slashParsed)) ?? content;

    // Build the multipart content for the model's latest user turn
    const userContentForModel = await buildUserContentWithAttachments({
      text: modelText,
      attachments: (attachments ?? []) as Attachment[],
    });

    const messagesForModel = [
      {
        role: "system" as const,
        content: composeSystemMessage([
          CHAT_SYSTEM_PROMPT,
          memoryBlock,
          conversation.mode === "image" ? IMAGE_MODE_SYSTEM_PROMPT : null,
          slashParsed ? slashSystemPrompt(slashParsed) : null,
          customSlashBlock,
          // Custom prompt LAST so its override framing wins on recency.
          customSystemPrompt
            ? buildCustomSystemPromptBlock(customSystemPrompt)
            : null,
        ]),
      },
      ...applyHistoryWindow(
        priorMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ),
      // Restate memory adjacent to the newest turn so recency beats any
      // language/style momentum from prior assistant turns in this thread.
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
      preface: { saved: { role: "user", id: savedUserMessage.id } },
    });
  } catch (err) {
    return fail(err);
  }
}
