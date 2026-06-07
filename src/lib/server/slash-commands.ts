export type SlashParse = {
  command: "summarize" | "diagram";
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
