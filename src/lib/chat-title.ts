/**
 * Derive a short conversation title from the first user message.
 *
 * Used both server-side (when the conversation is created) and client-side
 * (for the optimistic title shown after the first message but before the
 * server responds). Keeping the rule in one place avoids the two sides
 * drifting apart.
 */
export function deriveConversationTitle(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 50) return cleaned;
  const cut = cleaned.slice(0, 50);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + "…";
}
