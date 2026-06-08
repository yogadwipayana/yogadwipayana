export type SlashParse = {
  command: "summarize" | "diagram" | "word";
  argText: string;
} | null;

/**
 * Parse a slash command from the start of a user message.
 * Only triggers when content starts with `/cmd ` or is exactly `/cmd`.
 */
export function parseSlash(content: string): SlashParse {
  const trimmed = content.trim();

  const match = trimmed.match(/^\/([a-z]+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;

  const cmd = match[1];
  const rest = (match[2] ?? "").trim();

  switch (cmd) {
    case "summarize":
      return { command: "summarize", argText: rest };

    case "diagram":
      return { command: "diagram", argText: rest };

    case "word":
      return { command: "word", argText: rest };

    default:
      return null;
  }
}

/**
 * Build a system prompt that tells the model how to handle the slash command.
 */
export function slashSystemPrompt(p: NonNullable<SlashParse>): string {
  switch (p.command) {
    case "summarize":
      return (
        "The user typed `/summarize`. Produce a concise structured summary of either the " +
        "supplied text or the previous conversation if no text is given. " +
        "Output: 1-sentence TL;DR, then 3–6 bullet key points, then any open questions."
      );

    case "diagram":
      return (
        "The user typed `/diagram`. You MUST output a Mermaid diagram as plain text — do NOT call `image_generate` or any other tool. " +
        "Produce a valid Mermaid diagram inside a ```mermaid code block that represents the supplied subject. " +
        "Pick the most appropriate diagram type (flowchart, sequenceDiagram, classDiagram, erDiagram, stateDiagram-v2, gantt). " +
        "Add a 1-sentence caption above the code block. Output only the caption and the code block — no other prose."
      );

    case "word":
      return (
        "The user typed `/word`. You MUST call the `word_generate` tool exactly once to produce a downloadable .docx document. " +
        "Write the FULL document body yourself as Markdown in the `markdown` argument — well-structured with headings, lists, tables, bold/italic, and any other formatting the content calls for. Do not leave placeholders. " +
        "Derive a short, descriptive `title` from the request. If the user gave a topic, write a complete document on it; if they pasted text, convert that text into a clean Word document. " +
        "After the tool returns, your reply MUST contain the markdown download link `[Download <title>.docx](url)` and nothing more than a brief one-line confirmation."
      );
  }
}

/**
 * Optionally pick a different model for a slash command.
 * Currently a no-op — returns currentModel unchanged.
 */
export function autoPickModelFor(
  _p: NonNullable<SlashParse>,
  currentModel: string,
): string {
  return currentModel;
}

/**
 * Rewrite the user turn that is sent to the MODEL for slash commands whose
 * behaviour depends on tool-calling.
 *
 * Our OpenAI-compatible gateway ignores forced `tool_choice` (both the object
 * form and `"required"`); only `"auto"` is honoured. Under `auto`, the model
 * decides from the *user message* whether to call a tool — a system-prompt
 * instruction alone is not enough to override an intent like "belajar …"
 * ("teach me …"), so the model just answers in chat and the tool never fires.
 *
 * For `/word` we therefore reframe the user turn into an explicit
 * "create a .docx and call word_generate" instruction. The ORIGINAL `/word …`
 * text is still what gets persisted to the DB and shown in the transcript —
 * only the copy handed to the model for this turn is rewritten.
 *
 * Returns the rewritten content, or null to leave the user turn unchanged.
 */
export function slashRewriteUserContent(
  p: NonNullable<SlashParse>,
): string | null {
  switch (p.command) {
    case "word": {
      const topic = p.argText.trim();
      const subject = topic.length > 0 ? topic : "the previous conversation";
      return (
        "Create a downloadable Microsoft Word (.docx) document and call the " +
        "`word_generate` tool exactly once to produce it. Write the FULL " +
        "document body yourself as well-structured Markdown in the `markdown` " +
        "argument (headings, lists, tables, bold/italic as appropriate) — no " +
        "placeholders. Derive a short descriptive `title`. After the tool " +
        "returns, reply with only a one-line confirmation plus the markdown " +
        "download link `[Download <title>.docx](url)`.\n\n" +
        `Document topic / source:\n${subject}`
      );
    }

    default:
      return null;
  }
}
