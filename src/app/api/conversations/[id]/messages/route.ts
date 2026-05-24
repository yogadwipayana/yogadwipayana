import { access } from "node:fs/promises";
import { join } from "node:path";
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
import { fail } from "@/lib/server/api-response";
import { runChatStream } from "@/lib/server/chat-stream";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { validatePublicHttpUrl } from "@/lib/server/safe-fetch";
import { parseSlash, slashSystemPrompt } from "@/lib/server/slash-commands";
import {
  buildAttachmentFooter,
  buildUserContentWithAttachments,
  type Attachment,
} from "@/lib/server/vision";
import { createClient } from "@/utils/supabase/server";

/**
 * Returns the local filesystem path if the URL points to one of our own
 * /uploads/ files, or null otherwise.
 * Rejects any path that contains traversal segments.
 */
function getOwnUploadPath(rawUrl: string): string | null {
  try {
    const { pathname } = new URL(rawUrl);
    if (!/^\/uploads\/[^/]+$/.test(pathname)) return null;
    return join(process.cwd(), "public", pathname);
  } catch {
    return null;
  }
}

/**
 * Like validatePublicHttpUrl but short-circuits for our own uploaded files:
 * instead of an SSRF check, it simply verifies the file exists on disk.
 */
async function validateAttachmentUrl(
  rawUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const localPath = getOwnUploadPath(rawUrl);
  if (localPath) {
    try {
      await access(localPath);
      return { ok: true };
    } catch {
      return { ok: false, error: "Uploaded file not found on server" };
    }
  }
  return validatePublicHttpUrl(rawUrl);
}

export const runtime = "nodejs";

const AttachmentSchema = z.object({
  kind: z.enum(["image", "pdf"]),
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

    // Build the multipart content for the model's latest user turn
    const userContentForModel = await buildUserContentWithAttachments({
      text: content,
      attachments: (attachments ?? []) as Attachment[],
    });

    // Parse slash command (if any) — original content is kept in DB unchanged
    const slashParsed = parseSlash(content);

    const messagesForModel = [
      { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
      ...(conversation.mode === "image"
        ? [{ role: "system" as const, content: IMAGE_MODE_SYSTEM_PROMPT }]
        : []),
      // Inject slash-command system message after the base system prompt(s)
      ...(slashParsed
        ? [{ role: "system" as const, content: slashSystemPrompt(slashParsed) }]
        : []),
      ...priorMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: userContentForModel },
    ];

    return runChatStream({
      supabase,
      conversationId,
      userId: user.id,
      model: conversation.model,
      messages: messagesForModel,
      preface: { saved: { role: "user", id: savedUserMessage.id } },
      abortSignal: request.signal,
    });
  } catch (err) {
    return fail(err);
  }
}
