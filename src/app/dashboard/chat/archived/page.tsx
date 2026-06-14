// /dashboard/chat/archived. Static route takes precedence over the sibling [id]
// dynamic segment, so the shell's renderMain shows the Archived view instead of
// loading "archived" as a conversation id. Returns null — chat content is
// URL-segment-driven through the shell.
export default function ChatArchivedPage() {
  return null;
}
