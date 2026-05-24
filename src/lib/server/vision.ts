import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";

import { extractPdfText } from "@/lib/server/pdf-parse";

/**
 * If the URL points to one of our own /uploads/ files, return the absolute
 * filesystem path so we can read it directly. Otherwise return null.
 */
function getLocalUploadPath(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    if (!/^\/uploads\/[^/]+$/.test(pathname)) return null;
    return join(process.cwd(), "public", pathname);
  } catch {
    return null;
  }
}

/**
 * Resolve an image attachment to a URL suitable for the model:
 * - Own uploads → base64 data URL (works on localhost and in prod without
 *   requiring the model to make an outbound HTTP request)
 * - External URLs → pass through as-is
 */
async function resolveImageUrl(att: Attachment): Promise<string> {
  const localPath = getLocalUploadPath(att.url);
  if (localPath) {
    try {
      const buffer = await readFile(localPath);
      return `data:${att.mime};base64,${buffer.toString("base64")}`;
    } catch {
      // Fall back to the original URL if file read fails
    }
  }
  return att.url;
}

type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

export interface Attachment {
  kind: "image" | "pdf";
  url: string;
  name: string;
  mime: string;
  size: number;
}

/**
 * Build the `content` field for the latest user turn.
 *
 * - If there are no attachments, returns the plain text string so behaviour
 *   is identical to before.
 * - If there are attachments, returns a multipart content array:
 *   1. The user's typed text as a `{ type: "text" }` part.
 *   2. Each image as a `{ type: "image_url" }` part.
 *   3. Each PDF as a `{ type: "text" }` part containing extracted text (or an
 *      error notice if extraction fails).
 */
export async function buildUserContentWithAttachments(args: {
  text: string;
  attachments: Attachment[];
}): Promise<string | ContentPart[]> {
  const { text, attachments } = args;

  if (!attachments || attachments.length === 0) {
    return text;
  }

  // Surface the URLs of any image attachments alongside the user's text so the
  // model can pass them to URL-taking tools (image_edit, web_fetch). The model
  // also sees the bytes via the image_url parts below — the URL line is purely
  // so the assistant can quote it back into a tool call.
  const imageUrls = attachments
    .filter((a) => a.kind === "image")
    .map((a) => a.url);
  const textWithUrls =
    imageUrls.length > 0
      ? `${text}\n\n[Attached images: ${imageUrls.join(", ")}]`
      : text;

  const parts: ContentPart[] = [{ type: "text", text: textWithUrls }];

  for (const att of attachments) {
    if (att.kind === "image") {
      const imageUrl = await resolveImageUrl(att);
      parts.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    } else {
      // PDF — extract text server-side
      try {
        const extracted = await extractPdfText(att.url);
        parts.push({
          type: "text",
          text: `[Attached PDF: ${att.name}]\n\n${extracted}\n`,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        parts.push({
          type: "text",
          text: `[Attached PDF: ${att.name} — could not extract text: ${reason}]`,
        });
      }
    }
  }

  return parts;
}

/**
 * Build the markdown footer appended to the DB-persisted user message so
 * attachments are visible in conversation history and share/export views.
 */
export function buildAttachmentFooter(attachments: Attachment[]): string {
  if (!attachments || attachments.length === 0) return "";

  const lines = attachments.map((att) =>
    att.kind === "image"
      ? `![${att.name}](${att.url})`
      : `[📎 ${att.name}](${att.url})`,
  );

  return "\n\n" + lines.join("\n");
}
