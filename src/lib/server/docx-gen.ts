import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import markdownDocx, { Packer } from "markdown-docx";

/**
 * Generates a Microsoft Word (.docx) file from a Markdown string. The content
 * is converted with `markdown-docx` (built on `docx` + `marked`, so headings,
 * lists, bold/italic, tables, code blocks, and blockquotes all map across).
 *
 * The resulting bytes are written to public/generated-documents/ and the
 * public URL path is returned. This mirrors image-gen.ts so the chat tool and
 * persistence layer behave identically to image generation.
 *
 * Conversion is fast (sub-second) and fully in-memory until the final write —
 * no external API, no streaming. The optional `abortSignal` lets a cancelled
 * chat turn skip the disk write.
 */
export type GenerateDocxOptions = {
  /** Markdown body to convert into the document. */
  markdown: string;
  /** Human-readable document title, used for the download filename. */
  title?: string;
  /** External AbortSignal — checked before the disk write. */
  abortSignal?: AbortSignal;
};

const MAX_MARKDOWN_CHARS = 200_000;

export async function generateDocx(
  opts: GenerateDocxOptions,
): Promise<{ url: string; title: string }> {
  const markdown = opts.markdown?.trim();
  if (!markdown) {
    throw new Error("Cannot generate a document from empty content");
  }
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    throw new Error(
      `Document content is too large (${markdown.length} chars, max ${MAX_MARKDOWN_CHARS})`,
    );
  }

  const title = sanitizeTitle(opts.title) || "Document";

  if (opts.abortSignal?.aborted) {
    throw new Error("Document generation aborted");
  }

  const doc = await markdownDocx(markdown);
  const buffer = await Packer.toBuffer(doc);

  if (opts.abortSignal?.aborted) {
    throw new Error("Document generation aborted");
  }

  const filename = `${Date.now()}-${randomUUID()}.docx`;
  const outDir = join(process.cwd(), "public", "generated-documents");

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, filename), buffer);

  return { url: `/generated-documents/${filename}`, title };
}

/**
 * Strips characters that are unsafe or awkward in a filename and clamps length.
 * Returns an empty string if nothing usable remains.
 */
function sanitizeTitle(raw: string | undefined): string {
  if (!raw) return "";
  const unsafe = /[<>:"/\\|?* -]+/g;
  return raw
    .replace(unsafe, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
