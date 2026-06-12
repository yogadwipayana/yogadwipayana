/**
 * Server-side PDF text extraction using pdf-parse.
 * Uses a dynamic import so the heavy native module is only loaded on demand.
 */

import { safeFetch } from "@/lib/server/safe-fetch";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Extract text from an in-memory PDF buffer, truncated to `maxBytes` UTF-8 bytes.
 *
 * Throws a descriptive Error if the buffer exceeds the size limit or parsing fails.
 */
export async function extractPdfTextFromBuffer(
  buffer: Buffer,
  maxBytes = 30_000,
): Promise<string> {
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF exceeds 20 MB limit");
  }
  try {
    const { default: pdfParse } = await import("pdf-parse");
    const result = await pdfParse(buffer);
    const text = result.text ?? "";
    // Truncate to maxBytes (UTF-8 safe via Buffer)
    const encoded = Buffer.from(text, "utf8");
    if (encoded.byteLength <= maxBytes) return text;
    return encoded.subarray(0, maxBytes).toString("utf8");
  } catch (err) {
    throw new Error(
      `pdf-parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Fetch a PDF from `url`, extract its text content, and return it truncated
 * to `maxBytes` UTF-8 bytes.
 *
 * Goes through the SSRF guard, so this only works for public URLs — for our
 * own uploaded files, read the bytes from disk and call
 * `extractPdfTextFromBuffer` instead.
 *
 * Throws a descriptive Error on fetch failure, bad status, or parse failure.
 */
export async function extractPdfText(
  url: string,
  maxBytes = 30_000,
): Promise<string> {
  let buffer: ArrayBuffer;
  try {
    const res = await safeFetch(url, { timeoutMs: FETCH_TIMEOUT_MS });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching PDF`);
    }
    const sizeHeader = res.headers.get("content-length");
    if (sizeHeader && Number(sizeHeader) > MAX_PDF_BYTES) {
      throw new Error("PDF exceeds 20 MB limit");
    }
    buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_PDF_BYTES) {
      throw new Error("PDF exceeds 20 MB limit");
    }
  } catch (err) {
    throw new Error(
      `Failed to fetch PDF: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return extractPdfTextFromBuffer(Buffer.from(buffer), maxBytes);
}
