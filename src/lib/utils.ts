import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert markdown source to readable plain text suitable for pasting into
 * other apps. Handles bold/italic, inline code, fenced code blocks, tables,
 * headings, blockquotes, links, images, and horizontal rules.
 */
export function stripMarkdown(md: string): string {
  let s = md;

  // Fenced code blocks — keep content, strip fences
  s = s.replace(/^```[^\n]*\n([\s\S]*?)^```/gm, "$1");

  // Table rows — convert pipes to tabs, strip alignment rows
  s = s.replace(/^\|(.+)\|$/gm, (_, row: string) =>
    row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
      .join("\t"),
  );
  // Remove table separator rows (e.g. ---|---:)
  s = s.replace(/^[\t -]+$/gm, "");

  // Headings — strip leading #s
  s = s.replace(/^#{1,6}\s+/gm, "");

  // Blockquotes — strip leading >
  s = s.replace(/^>\s?/gm, "");

  // Horizontal rules
  s = s.replace(/^[-*_]{3,}\s*$/gm, "");

  // Bold + italic
  s = s.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  s = s.replace(/_{1,3}([^_]+)_{1,3}/g, "$1");

  // Inline code — keep the content
  s = s.replace(/`([^`]+)`/g, "$1");

  // Images — keep alt text
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Links — keep link text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Collapse 3+ blank lines to 2
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
