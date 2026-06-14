// /dashboard/chat/commands. Static route takes precedence over the sibling [id]
// dynamic segment, so the shell's renderMain shows the Custom Commands view
// instead of loading "commands" as a conversation id. Returns null — chat
// content is URL-segment-driven through the shell.
export default function ChatCommandsPage() {
  return null;
}
