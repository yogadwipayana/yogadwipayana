export type SlashParse = {
  command: "summarize" | "translate" | "explain" | "diagram";
  argText: string;
  language?: string;
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

    case "translate": {
      // /translate <lang> <text>
      // lang = first whitespace-delimited token; rest = everything after
      const spaceIdx = rest.search(/\s/);
      if (spaceIdx === -1) {
        // Only a lang word, no text
        return {
          command: "translate",
          argText: "",
          language: rest || "English",
        };
      }
      const lang = rest.slice(0, spaceIdx).trim();
      const argText = rest.slice(spaceIdx + 1).trim();
      return {
        command: "translate",
        argText,
        language: lang || "English",
      };
    }

    case "explain":
      return { command: "explain", argText: rest };

    case "diagram":
      return { command: "diagram", argText: rest };

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

    case "translate":
      return (
        `The user typed \`/translate\`. Translate the supplied text into ${p.language ?? "English"}. ` +
        "Preserve markdown structure, code blocks, and inline code verbatim. " +
        "Output ONLY the translation."
      );

    case "explain":
      return (
        "The user typed `/explain`. Walk through the supplied text/code step by step. " +
        "Use ## headings for sections (Overview, Step-by-step, Gotchas). " +
        "Be precise and beginner-friendly."
      );

    case "diagram":
      return (
        "The user typed `/diagram`. You MUST output a Mermaid diagram as plain text — do NOT call `image_generate` or any other tool. " +
        "Produce a valid Mermaid diagram inside a ```mermaid code block that represents the supplied subject. " +
        "Pick the most appropriate diagram type (flowchart, sequenceDiagram, classDiagram, erDiagram, stateDiagram-v2, gantt). " +
        "Add a 1-sentence caption above the code block. Output only the caption and the code block — no other prose."
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
