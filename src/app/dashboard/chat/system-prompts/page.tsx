// /dashboard/chat/system-prompts. Static route takes precedence over the
// sibling [id] dynamic segment, so the shell's renderMain shows the System
// Prompts config view (driven by useSelectedLayoutSegment) instead of trying
// to load "system-prompts" as a conversation id. Returns null like the other
// chat route pages — all chat content is URL-segment-driven through the shell.
export default function ChatSystemPromptsPage() {
  return null;
}
