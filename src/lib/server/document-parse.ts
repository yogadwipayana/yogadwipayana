/**
 * Server-side text extraction for document attachments (DOCX, XLSX/XLS, CSV,
 * TXT, Markdown). PDFs are handled separately by pdf-parse.ts.
 *
 * Heavy parsers (mammoth, xlsx) are loaded via dynamic import so they're only
 * pulled in when a matching document is actually attached.
 */

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_MIME = "application/vnd.ms-powerpoint";

type DocFormat = "docx" | "spreadsheet" | "presentation" | "text";

/**
 * Resolve the extraction strategy from the MIME type, falling back to the
 * filename extension (browsers sometimes send `application/octet-stream` or an
 * empty type for office files).
 */
function resolveFormat(mime: string, filename: string): DocFormat | null {
  const m = mime.toLowerCase();
  if (m === DOCX_MIME) return "docx";
  if (m === XLSX_MIME || m === XLS_MIME) return "spreadsheet";
  if (m === PPTX_MIME || m === PPT_MIME) return "presentation";
  if (m === "text/csv" || m === "text/plain" || m === "text/markdown") {
    return "text";
  }
  if (m.startsWith("text/")) return "text";

  // Fall back to extension when the MIME is generic/missing.
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "docx") return "docx";
  if (ext === "xlsx" || ext === "xls") return "spreadsheet";
  if (ext === "pptx" || ext === "ppt") return "presentation";
  if (ext === "csv" || ext === "txt" || ext === "md" || ext === "markdown") {
    return "text";
  }
  return null;
}

/** Truncate a string to `maxBytes` UTF-8 bytes without splitting a codepoint. */
function truncateUtf8(text: string, maxBytes: number): string {
  const encoded = Buffer.from(text, "utf8");
  if (encoded.byteLength <= maxBytes) return text;
  return encoded.subarray(0, maxBytes).toString("utf8");
}

/**
 * Extract readable text from a document buffer, truncated to `maxBytes` UTF-8
 * bytes. Throws a descriptive Error on an oversized buffer, an unsupported
 * format, or a parse failure.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mime: string,
  filename: string,
  maxBytes = 30_000,
): Promise<string> {
  if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error("Document exceeds 20 MB limit");
  }

  const format = resolveFormat(mime, filename);
  if (!format) {
    throw new Error(`Unsupported document type: ${mime || filename}`);
  }

  try {
    if (format === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return truncateUtf8(result.value ?? "", maxBytes);
    }

    if (format === "spreadsheet") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets = workbook.SheetNames.map((name) => {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
        return `=== ${name} ===\n${csv}`;
      });
      return truncateUtf8(sheets.join("\n\n"), maxBytes);
    }

    if (format === "presentation") {
      const { parseOffice } = await import("officeparser");
      const ast = await parseOffice(buffer);
      return truncateUtf8(ast.toText(), maxBytes);
    }

    // text / csv / markdown
    return truncateUtf8(buffer.toString("utf8"), maxBytes);
  } catch (err) {
    throw new Error(
      `Document parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
