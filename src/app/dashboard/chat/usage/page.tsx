// /dashboard/chat/usage. Static route takes precedence over the sibling [id]
// dynamic segment, so the shell's renderMain shows the Usage view instead of
// loading "usage" as a conversation id. Returns null — chat content is
// URL-segment-driven through the shell.
export default function ChatUsagePage() {
  return null;
}
