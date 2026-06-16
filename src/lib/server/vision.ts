import type OpenAI from "openai";

import { getObjectBytes, keyFromProxyUrl, objectExists } from "@/lib/r2";
import { extractPdfText, extractPdfTextFromBuffer } from "@/lib/server/pdf-parse";
import { extractDocumentText } from "@/lib/server/document-parse";
import { validatePublicHttpUrl } from "@/lib/server/safe-fetch";

/**
 * Validate an attachment URL before it reaches the model. Short-circuits for our
 * own R2-backed files (/api/files/<key>): instead of an SSRF check — which would
 * reject our own same-origin/localhost proxy URLs — it verifies the object
 * exists in the bucket. Everything else goes through the SSRF guard.
 */
export async function validateAttachmentUrl(
  rawUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = keyFromProxyUrl(rawUrl);
  if (key) {
    return (await objectExists(key))
      ? { ok: true }
      : { ok: false, error: "Uploaded file not found in storage" };
  }
  return validatePublicHttpUrl(rawUrl);
}

/**
 * If the URL is one of our own R2-backed proxy URLs (/api/files/<key>), fetch
 * the bytes back from R2 so we can inline/extract them directly — bypassing the
 * SSRF-guarded fetch, which would block our own same-origin/localhost URLs.
 * Returns null for anything that isn't our own file.
 */
async function getOwnFileBytes(url: string): Promise<Buffer | null> {
  const key = keyFromProxyUrl(url);
  if (!key) return null;
  try {
    const { body } = await getObjectBytes(key);
    return body;
  } catch {
    return null;
  }
}

/**
 * Resolve an image attachment to a URL suitable for the model:
 * - Own uploads → base64 data URL (works without requiring the model to make
 *   an outbound HTTP request to a private, auth-gated proxy URL)
 * - External URLs → pass through as-is
 */
async function resolveImageUrl(att: Attachment): Promise<string> {
  const bytes = await getOwnFileBytes(att.url);
  if (bytes) {
    return `data:${att.mime};base64,${bytes.toString("base64")}`;
  }
  return att.url;
}

type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

export interface Attachment {
  kind: "image" | "pdf" | "document";
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
 *   4. Each document (DOCX/XLSX/CSV/TXT/MD) as a `{ type: "text" }` part with
 *      its extracted text (or an error notice if extraction fails).
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

  // Each attachment resolves independently (R2 fetch / PDF / doc extraction),
  // so process them in parallel. Promise.all preserves array order, so the
  // appended parts keep the same order as a sequential loop would produce.
  const attachmentParts = await Promise.all(
    attachments.map(async (att): Promise<ContentPart[]> => {
      if (att.kind === "image") {
        const imageUrl = await resolveImageUrl(att);
        return [
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ];
      } else if (att.kind === "pdf") {
        // PDF — extract text server-side. For our own R2-backed files, fetch the
        // bytes from R2 directly: the SSRF-guarded fetch in extractPdfText()
        // blocks our own private proxy URL, so we read the object instead.
        try {
          const ownBytes = await getOwnFileBytes(att.url);
          const extracted = ownBytes
            ? await extractPdfTextFromBuffer(ownBytes)
            : await extractPdfText(att.url);
          return [
            {
              type: "text",
              text: `[Attached PDF: ${att.name}]\n\n${extracted}\n`,
            },
          ];
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          return [
            {
              type: "text",
              text: `[Attached PDF: ${att.name} — could not extract text: ${reason}]`,
            },
          ];
        }
      } else {
        // Document (DOCX / XLSX / CSV / TXT / Markdown) — extract text from the
        // uploaded bytes in R2. Attachments are always our own files, so we
        // fetch them from R2 rather than over HTTP.
        try {
          const ownBytes = await getOwnFileBytes(att.url);
          if (!ownBytes) {
            throw new Error("Document must be an uploaded file");
          }
          const extracted = await extractDocumentText(
            ownBytes,
            att.mime,
            att.name,
          );
          return [
            {
              type: "text",
              text: `[Attached document: ${att.name}]\n\n${extracted}\n`,
            },
          ];
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          return [
            {
              type: "text",
              text: `[Attached document: ${att.name} — could not extract text: ${reason}]`,
            },
          ];
        }
      }
    }),
  );

  for (const group of attachmentParts) {
    parts.push(...group);
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
