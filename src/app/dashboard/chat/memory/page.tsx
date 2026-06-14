// /dashboard/chat/memory. Static route takes precedence over the sibling [id]
// dynamic segment, so the shell's renderMain shows the Memory config view
// instead of loading "memory" as a conversation id. Returns null — chat
// content is URL-segment-driven through the shell.
export default function ChatMemoryPage() {
  return null;
}
