import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { marked, type Token, type Tokens } from "marked";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TableOfContents,
  TextRun,
  WidthType,
  type IRunOptions,
} from "docx";

import { safeFetch } from "@/lib/server/safe-fetch";

/**
 * Generates a Microsoft Word (.docx) file from a Markdown string.
 *
 * The Markdown is tokenized with `marked`'s lexer and walked into native
 * `docx` nodes — headings, paragraphs, nested bullet/ordered lists, tables,
 * fenced code blocks, blockquotes, horizontal rules, and inline formatting
 * (bold/italic/strikethrough/inline-code/links) all map to real Word
 * formatting rather than being flattened to plain text.
 *
 * The resulting bytes are written to public/generated-documents/ and the
 * public URL path is returned, mirroring image-gen.ts so the chat tool and
 * persistence layer behave identically to image generation.
 *
 * Inline Markdown images (`![alt](url)`) are pre-fetched (http(s) via the SSRF
 * guard, or decoded from `data:` URIs) and embedded as native Word images,
 * scaled to fit the content width. Anything that can't be fetched or decoded
 * degrades gracefully to its alt text.
 *
 * When the document has enough headings, a real Word Table of Contents is
 * inserted after the title and the body starts on a fresh page. The page has no
 * running header or footer by default — content only.
 *
 * Conversion is in-memory apart from the optional remote-image fetches and the
 * final write — no document API, no streaming. The optional `abortSignal` lets
 * a cancelled chat turn skip the image fetches, the conversion finish, and the
 * disk write.
 */
export type GenerateDocxOptions = {
  /** Markdown body to convert into the document. */
  markdown: string;
  /** Human-readable document title, used for the download filename. */
  title?: string;
  /** External AbortSignal — checked before the disk write. */
  abortSignal?: AbortSignal;
  /**
   * Insert a Word Table of Contents after the title. Off by default — only
   * enable when the caller explicitly wants one (long reports, manuals). Even
   * when enabled, the doc still needs at least TOC_MIN_HEADINGS headings.
   */
  tableOfContents?: boolean;
};

const MAX_MARKDOWN_CHARS = 200_000;

// Twips (1/20 pt). 720 twips = 0.5 inch — one indent step per list level.
const INDENT_STEP = 720;
const HANGING = 360;
const MONO_FONT = "Consolas";
const CODE_FILL = "F2F2F2";
const QUOTE_BAR = "CCCCCC";
const BORDER = "CCCCCC";

const BULLET_REF = "md-bullet";
const ORDERED_REF = "md-ordered";

// US Letter in twips (DXA): 8.5" x 11". docx defaults to A4, so set this
// explicitly for consistent, report-standard output.
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const PAGE_MARGIN = 1440; // 1 inch
// Usable content width in EMUs (1 inch = 914400 EMU). Width minus both margins,
// in inches, times EMU-per-inch. Used to clamp inline images.
const CONTENT_WIDTH_EMU = ((PAGE_WIDTH - PAGE_MARGIN * 2) / 1440) * 914400;
const EMU_PER_PX = 9525; // 96 DPI: 914400 / 96

// A document needs at least this many headings (depth 1-3) before we bother
// inserting an automatic Table of Contents.
const TOC_MIN_HEADINGS = 3;

// Cap remote image fetches so a malicious/huge asset can't blow up generation.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 8_000;
const MAX_IMAGES = 20;

// Raster formats docx's ImageRun accepts without a separate SVG fallback.
type DocxImageType = "png" | "jpg" | "gif" | "bmp";

/** A successfully resolved inline image, keyed by its source URL/href. */
type ResolvedImage = {
  data: Buffer;
  type: DocxImageType;
  width: number;
  height: number;
};

/** Resolved images keyed by their original Markdown href. */
type ImageMap = Map<string, ResolvedImage>;

/** Inline content can be text or an embedded image. */
type InlineRun = TextRun | ImageRun;

// docx HeadingLevel only defines HEADING_1..HEADING_6.
const HEADING_BY_DEPTH = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

type DocChild = Paragraph | Table;

/** Inline formatting carried down the recursive inline walk. */
type InlineStyle = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  /** Direct run color (hex, no #). Used to force heading colors over the
   *  built-in Word heading styles, which otherwise win. */
  color?: string;
  /** Direct run size in half-points. Same rationale as `color`. */
  size?: number;
};

const BODY_FONT = "Times New Roman";
const HEADING_COLOR = "000000"; // black
const SUBTLE_COLOR = "000000"; // black

// Per-depth heading appearance, applied as DIRECT formatting (run + paragraph)
// so it overrides docx's built-in blue Heading1..6 styles. Sizes are
// half-points; spacing is twips.
const HEADING_SPECS = [
  { size: 36, color: HEADING_COLOR, bold: true, italics: false, before: 360, after: 120 }, // H1 18pt
  { size: 30, color: HEADING_COLOR, bold: true, italics: false, before: 280, after: 100 }, // H2 15pt
  { size: 26, color: SUBTLE_COLOR, bold: true, italics: false, before: 240, after: 80 }, // H3 13pt
  { size: 24, color: SUBTLE_COLOR, bold: true, italics: false, before: 200, after: 80 }, // H4 12pt
  { size: 22, color: SUBTLE_COLOR, bold: true, italics: true, before: 180, after: 60 }, // H5
  { size: 22, color: SUBTLE_COLOR, bold: false, italics: true, before: 160, after: 60 }, // H6
] as const;

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

  const tokens = marked.lexer(markdown);

  // Pre-fetch inline images before the synchronous token walk, so inlineRuns
  // can emit native ImageRuns. Anything that fails resolves to alt text.
  const imageRefs = collectImageRefs(tokens);
  const images = await resolveImages(imageRefs, opts.abortSignal);

  if (opts.abortSignal?.aborted) {
    throw new Error("Document generation aborted");
  }

  const { children, hasTitle } = tokensToChildren(tokens, images);
  const headingCount = countHeadings(tokens);
  const useToc = opts.tableOfContents === true && headingCount >= TOC_MIN_HEADINGS;

  // Insert a real Word TOC after the title block (when one was promoted). The
  // TOC ends with a page break so the body starts on a fresh page.
  const body = useToc ? withTableOfContents(children, hasTitle) : children;

  const doc = new Document({
    features: { updateFields: useToc },
    styles: documentStyles(),
    numbering: { config: numberingConfig() },
    sections: [
      {
        properties: {
          page: {
            // Explicit US Letter (12240 x 15840 DXA). docx defaults to A4.
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            // Standard 1-inch margins — the professional default for reports.
            margin: {
              top: PAGE_MARGIN,
              right: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
            },
          },
        },
        children: body.length > 0 ? body : [new Paragraph("")],
      },
    ],
  });

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
 * Professional document theme. Without this, docx falls back to Word's raw
 * built-in defaults (bright-blue headings, cramped spacing) which read as
 * unpolished. We define a clean, report-style look:
 *   - Calibri body at 11pt with 1.15 line spacing and a small paragraph gap,
 *     justified for an even right edge.
 *   - A muted near-black/charcoal heading hierarchy (not the default blue),
 *     with descending sizes and deliberate space above/below each level.
 * Sizes are in half-points (docx convention): 22 = 11pt, 32 = 16pt, etc.
 * Spacing is in twips (1/20 pt): 240 = 12pt.
 */
function documentStyles() {
  return {
    default: {
      document: {
        run: { font: BODY_FONT, size: 24, color: "000000" }, // 12pt
        paragraph: {
          spacing: { line: 360, after: 160 }, // 1.5 line, 8pt after
        },
      },
    },
    paragraphStyles: [
      {
        id: "Title",
        name: "Title",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: BODY_FONT, size: 56, bold: true, color: HEADING_COLOR }, // 28pt
        paragraph: {
          spacing: { before: 0, after: 120 },
        },
      },
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: BODY_FONT, size: 36, bold: true, color: HEADING_COLOR }, // 18pt
        paragraph: {
          spacing: { before: 360, after: 120 },
          keepNext: true,
        },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: BODY_FONT, size: 30, bold: true, color: HEADING_COLOR }, // 15pt
        paragraph: {
          spacing: { before: 280, after: 100 },
          keepNext: true,
        },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: BODY_FONT, size: 26, bold: true, color: SUBTLE_COLOR }, // 13pt
        paragraph: {
          spacing: { before: 240, after: 80 },
          keepNext: true,
        },
      },
      {
        id: "Heading4",
        name: "Heading 4",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: BODY_FONT, size: 24, bold: true, color: SUBTLE_COLOR }, // 12pt
        paragraph: {
          spacing: { before: 200, after: 80 },
          keepNext: true,
        },
      },
      {
        id: "Heading5",
        name: "Heading 5",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: BODY_FONT, size: 22, bold: true, italics: true, color: SUBTLE_COLOR },
        paragraph: {
          spacing: { before: 180, after: 60 },
          keepNext: true,
        },
      },
      {
        id: "Heading6",
        name: "Heading 6",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: BODY_FONT, size: 22, italics: true, color: SUBTLE_COLOR },
        paragraph: {
          spacing: { before: 160, after: 60 },
          keepNext: true,
        },
      },
    ],
  };
}

/** Build the bullet + ordered numbering definitions (6 nesting levels each). */
function numberingConfig() {
  const levels = (format: (typeof LevelFormat)[keyof typeof LevelFormat]) =>
    Array.from({ length: 6 }, (_, level) => ({
      level,
      format,
      text: format === LevelFormat.BULLET ? bulletGlyph(level) : `%${level + 1}.`,
      alignment: AlignmentType.START,
      style: {
        paragraph: {
          indent: {
            left: INDENT_STEP * (level + 1),
            hanging: HANGING,
          },
        },
      },
    }));

  return [
    { reference: BULLET_REF, levels: levels(LevelFormat.BULLET) },
    { reference: ORDERED_REF, levels: levels(LevelFormat.DECIMAL) },
  ];
}

function bulletGlyph(level: number): string {
  // Cycle the three common Word bullet glyphs by depth.
  return ["•", "◦", "▪"][level % 3];
}

/** Count depth 1-3 headings — the levels the TOC will list. */
function countHeadings(tokens: Token[]): number {
  let n = 0;
  for (const token of tokens) {
    if (token.type === "heading" && (token as Tokens.Heading).depth <= 3) n++;
  }
  return n;
}

/**
 * Splice a Word Table of Contents into the document. It goes after a promoted
 * title block when one is present, otherwise at the very top. The TOC lists
 * Heading 1-3 with clickable hyperlinks; Word populates it on open because
 * `features.updateFields` is enabled. A trailing page break pushes the body to
 * a fresh page so the TOC stands on its own.
 */
function withTableOfContents(children: DocChild[], hasTitle: boolean): DocChild[] {
  const toc = new TableOfContents("Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  });
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 0, after: 120 },
    children: [
      new TextRun({ text: "Contents", bold: true, color: HEADING_COLOR, size: 30 }),
    ],
  });
  const pageBreak = new Paragraph({ children: [new PageBreak()] });

  const insertAt = hasTitle ? 1 : 0;
  return [
    ...children.slice(0, insertAt),
    heading,
    toc,
    pageBreak,
    ...children.slice(insertAt),
  ];
}

function tokensToChildren(
  tokens: Token[],
  images: ImageMap,
): { children: DocChild[]; hasTitle: boolean } {
  const out: DocChild[] = [];
  // Promote a leading level-1 heading to the styled Title so the document opens
  // with a proper title block instead of a plain blue H1. Only the very first
  // block is eligible, and only if it's an H1.
  let titleConsumed = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (
      !titleConsumed &&
      i === 0 &&
      token.type === "heading" &&
      (token as Tokens.Heading).depth === 1
    ) {
      const t = token as Tokens.Heading;
      out.push(
        new Paragraph({
          style: "Title",
          spacing: { before: 0, after: 200 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "D9DEE3", space: 8 },
          },
          children: inlineRuns(t.tokens ?? [], {
            bold: true,
            color: HEADING_COLOR,
            size: 56,
          }, images),
        }),
      );
      titleConsumed = true;
      continue;
    }
    pushToken(token, out, images);
  }
  return { children: out, hasTitle: titleConsumed };
}

function pushToken(token: Token, out: DocChild[], images: ImageMap): void {
  switch (token.type) {
    case "heading": {
      const t = token as Tokens.Heading;
      const depth = Math.min(t.depth, 6);
      const spec = HEADING_SPECS[depth - 1];
      // Apply the heading appearance as DIRECT run formatting (color/size/bold)
      // so it beats docx's built-in blue Heading styles, plus a styled spacing
      // paragraph. We still pass `heading:` so the doc keeps a proper outline.
      out.push(
        new Paragraph({
          heading: HEADING_BY_DEPTH[depth - 1],
          spacing: { before: spec.before, after: spec.after },
          keepNext: true,
          children: inlineRuns(t.tokens ?? [], {
            bold: spec.bold,
            italics: spec.italics,
            color: spec.color,
            size: spec.size,
          }, images),
        }),
      );
      break;
    }

    case "paragraph": {
      const t = token as Tokens.Paragraph;
      // A paragraph that is just an image (common for `![alt](url)` on its own
      // line) is centered with no justification, so the picture sits cleanly.
      const onlyImage = isImageOnlyParagraph(t);
      out.push(
        new Paragraph({
          alignment: onlyImage ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
          children: inlineRuns(t.tokens ?? [], {}, images),
        }),
      );
      break;
    }

    case "list": {
      pushList(token as Tokens.List, out, 0, images);
      break;
    }

    case "table": {
      out.push(buildTable(token as Tokens.Table, images));
      break;
    }

    case "code": {
      pushCode(token as Tokens.Code, out);
      break;
    }

    case "blockquote": {
      out.push(decorateBlockquote(token as Tokens.Blockquote, images));
      break;
    }

    case "hr": {
      out.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 1 },
          },
          children: [],
        }),
      );
      break;
    }

    case "space":
      break;

    default: {
      // Fallback: render any unhandled block as its raw text so nothing is lost.
      const raw = (token as { text?: string; raw?: string }).text ??
        (token as { raw?: string }).raw ??
        "";
      if (raw.trim()) {
        out.push(new Paragraph({ children: [new TextRun(raw)] }));
      }
      break;
    }
  }
}

/** True when a paragraph's only meaningful inline content is a single image. */
function isImageOnlyParagraph(t: Tokens.Paragraph): boolean {
  const meaningful = (t.tokens ?? []).filter(
    (tok) => !(tok.type === "text" && !(tok as Tokens.Text).text.trim()),
  );
  return meaningful.length === 1 && meaningful[0].type === "image";
}

/** Render a blockquote's inline content as a single indented, bar-bordered paragraph. */
function decorateBlockquote(t: Tokens.Blockquote, images: ImageMap): Paragraph {
  // Flatten the blockquote's inline tokens (handles the common single-paragraph case).
  const inlineTokens = (t.tokens ?? []).flatMap((child) =>
    child.type === "paragraph"
      ? ((child as Tokens.Paragraph).tokens ?? [])
      : [child as Token],
  );
  return new Paragraph({
    indent: { left: INDENT_STEP },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: QUOTE_BAR, space: 12 },
    },
    spacing: { before: 120, after: 120 },
    children: inlineRuns(inlineTokens, { italics: true }, images),
  });
}

function pushList(
  list: Tokens.List,
  out: DocChild[],
  level: number,
  images: ImageMap,
): void {
  const reference = list.ordered ? ORDERED_REF : BULLET_REF;
  for (const item of list.items) {
    const itemTokens = item.tokens ?? [];
    // Inline content of the list item (paragraph/text tokens), excluding nested lists.
    const inlineParts: Token[] = [];
    const nestedLists: Tokens.List[] = [];

    for (const child of itemTokens) {
      if (child.type === "list") {
        nestedLists.push(child as Tokens.List);
      } else if (child.type === "text") {
        const tt = child as Tokens.Text;
        inlineParts.push(...(tt.tokens ?? [{ type: "text", raw: tt.text, text: tt.text } as Token]));
      } else if (child.type === "paragraph") {
        inlineParts.push(...((child as Tokens.Paragraph).tokens ?? []));
      } else {
        inlineParts.push(child);
      }
    }

    const prefix = item.task ? `${item.checked ? "☑" : "☐"} ` : "";
    const runs = inlineRuns(inlineParts, {}, images);
    out.push(
      new Paragraph({
        numbering: { reference, level: Math.min(level, 5) },
        children: prefix ? [new TextRun(prefix), ...runs] : runs,
      }),
    );

    for (const nested of nestedLists) {
      pushList(nested, out, level + 1, images);
    }
  }
}

function pushCode(token: Tokens.Code, out: DocChild[]): void {
  const lines = token.text.split("\n");
  // One shaded paragraph; subsequent lines use TextRun break to stay in the same box.
  const runs: TextRun[] = [];
  lines.forEach((line, i) => {
    runs.push(
      new TextRun({
        text: line,
        font: MONO_FONT,
        size: 19,
        color: "000000",
        break: i === 0 ? 0 : 1,
      }),
    );
  });
  const codeBorder = { style: BorderStyle.SINGLE, size: 4, color: "E1E4E8", space: 6 };
  out.push(
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: CODE_FILL, color: "auto" },
      border: {
        top: codeBorder,
        bottom: codeBorder,
        left: codeBorder,
        right: codeBorder,
      },
      indent: { left: 120, right: 120 },
      spacing: { before: 160, after: 160, line: 264 },
      children: runs,
    }),
  );
}

function buildTable(token: Tokens.Table, images: ImageMap): Table {
  const colCount = token.header.length;
  const border = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
  const cellBorders = { top: border, bottom: border, left: border, right: border };

  const makeRow = (cells: Tokens.TableCell[], header: boolean) =>
    new TableRow({
      tableHeader: header,
      children: cells.map(
        (cell) =>
          new TableCell({
            borders: cellBorders,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            shading: header
              ? { type: ShadingType.CLEAR, fill: "D9D9D9", color: "auto" }
              : undefined,
            children: [
              new Paragraph({
                children: inlineRuns(cell.tokens ?? [], { bold: header }, images),
              }),
            ],
          }),
      ),
    });

  const rows = [
    makeRow(token.header, true),
    ...token.rows.map((row) => makeRow(row, false)),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: colCount }, () =>
      Math.floor(9000 / Math.max(colCount, 1)),
    ),
    rows,
  });
}

/** Recursively convert inline tokens into styled runs (text or images). */
function inlineRuns(tokens: Token[], style: InlineStyle, images: ImageMap): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        if (t.tokens && t.tokens.length > 0) {
          runs.push(...inlineRuns(t.tokens, style, images));
        } else {
          runs.push(makeRun(t.text, style));
        }
        break;
      }
      case "strong":
        runs.push(...inlineRuns((token as Tokens.Strong).tokens ?? [], { ...style, bold: true }, images));
        break;
      case "em":
        runs.push(...inlineRuns((token as Tokens.Em).tokens ?? [], { ...style, italics: true }, images));
        break;
      case "del":
        runs.push(...inlineRuns((token as Tokens.Del).tokens ?? [], { ...style, strike: true }, images));
        break;
      case "codespan":
        runs.push(
          new TextRun({
            text: (token as Tokens.Codespan).text,
            font: MONO_FONT,
            size: 20,
            color: "000000",
            shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
            ...runStyle(style),
          }),
        );
        break;
      case "link": {
        const t = token as Tokens.Link;
        const label = inlineRuns(t.tokens ?? [], style, images);
        runs.push(...(label.length > 0 ? label : [makeRun(t.text, style)]));
        break;
      }
      case "br":
        runs.push(new TextRun({ text: "", break: 1 }));
        break;
      case "escape":
        runs.push(makeRun((token as Tokens.Escape).text, style));
        break;
      case "image": {
        const t = token as Tokens.Image;
        const resolved = images.get(t.href);
        if (resolved) {
          runs.push(imageRun(resolved));
        } else {
          // Couldn't fetch/decode — fall back to the alt text so nothing vanishes.
          runs.push(makeRun(t.text || t.title || "[image]", { ...style, italics: true }));
        }
        break;
      }
      default: {
        const raw = (token as { text?: string }).text ?? "";
        if (raw) runs.push(makeRun(raw, style));
        break;
      }
    }
  }
  return runs;
}

function makeRun(text: string, style: InlineStyle): TextRun {
  return new TextRun({ text, ...runStyle(style) });
}

/** Build a scaled ImageRun from a resolved image, clamped to the content width. */
function imageRun(img: ResolvedImage): ImageRun {
  const { width, height } = scaleToContentWidth(img.width, img.height);
  return new ImageRun({
    type: img.type,
    data: img.data,
    transformation: { width, height },
  });
}

/** Scale image pixels down so the width never exceeds the usable page width. */
function scaleToContentWidth(
  pxWidth: number,
  pxHeight: number,
): { width: number; height: number } {
  const maxWidthPx = Math.floor(CONTENT_WIDTH_EMU / EMU_PER_PX);
  if (pxWidth <= 0 || pxHeight <= 0) {
    return { width: maxWidthPx, height: Math.round(maxWidthPx * 0.75) };
  }
  if (pxWidth <= maxWidthPx) {
    return { width: pxWidth, height: pxHeight };
  }
  const scale = maxWidthPx / pxWidth;
  return { width: maxWidthPx, height: Math.max(1, Math.round(pxHeight * scale)) };
}

function runStyle(style: InlineStyle): Partial<IRunOptions> {
  return {
    bold: style.bold,
    italics: style.italics,
    strike: style.strike,
    ...(style.color ? { color: style.color } : {}),
    ...(style.size ? { size: style.size } : {}),
  };
}

/**
 * Walk every token tree and collect distinct image hrefs (inline + block).
 * Bounded by MAX_IMAGES so a document full of images can't fan out unbounded
 * network fetches.
 */
function collectImageRefs(tokens: Token[]): string[] {
  const seen = new Set<string>();
  const visit = (toks: Token[] | undefined) => {
    if (!toks) return;
    for (const tok of toks) {
      if (tok.type === "image") {
        const href = (tok as Tokens.Image).href?.trim();
        if (href && seen.size < MAX_IMAGES) seen.add(href);
      }
      // Recurse into any nested token arrays marked types expose.
      const t = tok as { tokens?: Token[]; items?: Tokens.ListItem[] };
      if (t.tokens) visit(t.tokens);
      if (t.items) {
        for (const item of t.items) visit(item.tokens);
      }
    }
  };
  visit(tokens);
  return [...seen];
}

/**
 * Resolve every collected href into an embeddable image, in parallel. Failures
 * (blocked host, oversize, undecodable, abort) are simply dropped — the walk
 * falls back to alt text for any href missing from the returned map.
 */
async function resolveImages(
  hrefs: string[],
  signal?: AbortSignal,
): Promise<ImageMap> {
  const map: ImageMap = new Map();
  if (hrefs.length === 0) return map;

  await Promise.all(
    hrefs.map(async (href) => {
      try {
        if (signal?.aborted) return;
        const resolved = await resolveOneImage(href, signal);
        if (resolved) map.set(href, resolved);
      } catch {
        // Drop — alt text fallback handles the gap.
      }
    }),
  );
  return map;
}

async function resolveOneImage(
  href: string,
  signal?: AbortSignal,
): Promise<ResolvedImage | null> {
  const bytes = href.startsWith("data:")
    ? decodeDataUri(href)
    : await fetchImageBytes(href, signal);
  if (!bytes) return null;

  const meta = sniffImage(bytes);
  if (!meta) return null;

  return { data: bytes, type: meta.type, width: meta.width, height: meta.height };
}

/** Decode a `data:` URI's base64/percent payload, enforcing the size cap. */
function decodeDataUri(uri: string): Buffer | null {
  const match = /^data:([^;,]*)?(;base64)?,([\s\S]*)$/.exec(uri);
  if (!match) return null;
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  try {
    const buf = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

/** Fetch a remote image through the SSRF guard, capping the body size. */
async function fetchImageBytes(
  url: string,
  signal?: AbortSignal,
): Promise<Buffer | null> {
  const res = await safeFetch(url, {
    timeoutMs: IMAGE_FETCH_TIMEOUT_MS,
    signal,
    headers: { Accept: "image/*" },
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const lenHeader = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(lenHeader) && lenHeader > MAX_IMAGE_BYTES) {
    await res.body?.cancel().catch(() => {});
    return null;
  }

  const arr = await res.arrayBuffer().catch(() => null);
  if (!arr) return null;
  if (arr.byteLength === 0 || arr.byteLength > MAX_IMAGE_BYTES) return null;
  return Buffer.from(arr);
}

/**
 * Detect image format and pixel dimensions from the binary header. Supports the
 * formats docx's ImageRun accepts (png, jpg, gif, bmp). Returns null for
 * anything unrecognized — including SVG, which ImageRun can't size reliably
 * without a width/height we'd have to parse from XML.
 */
function sniffImage(
  buf: Buffer,
): { type: DocxImageType; width: number; height: number } | null {
  // PNG: 8-byte signature, then IHDR with width/height as big-endian uint32.
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { type: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: "GIF87a"/"GIF89a", then width/height as little-endian uint16.
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { type: "gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // BMP: "BM", dimensions as little-endian int32 at offset 18/22.
  if (buf.length >= 26 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return {
      type: "bmp",
      width: Math.abs(buf.readInt32LE(18)),
      height: Math.abs(buf.readInt32LE(22)),
    };
  }

  // JPEG: starts with FFD8; scan segments for a SOF marker carrying dimensions.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    const dims = readJpegDimensions(buf);
    if (dims) return { type: "jpg", width: dims.width, height: dims.height };
  }

  return null;
}

/** Walk JPEG marker segments to the first Start-Of-Frame and read its size. */
function readJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let offset = 2; // skip the SOI marker (FFD8)
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0..SOF15 carry frame dimensions, excluding DHT(C4)/DAC(CC)/RST(C8).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
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
