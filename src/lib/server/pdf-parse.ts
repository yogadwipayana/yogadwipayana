/**
 * Server-side PDF text extraction using pdf-parse.
 * Uses a dynamic import so the heavy native module is only loaded on demand.
 */

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetch a PDF from `url`, extract its text content, and return it truncated
 * to `maxBytes` UTF-8 bytes.
 *
 * Throws a descriptive Error on fetch failure, bad status, or parse failure.
 */
export async function extractPdfText(
  url: string,
  maxBytes = 30_000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let buffer: ArrayBuffer;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching PDF`);
    }
    buffer = await res.arrayBuffer();
  } catch (err) {
    throw new Error(
      `Failed to fetch PDF: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  try {
    const { default: pdfParse } = await import("pdf-parse");
    const result = await pdfParse(Buffer.from(buffer));
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
