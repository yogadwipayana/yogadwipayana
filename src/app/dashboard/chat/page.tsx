// /dashboard/chat (no conversation selected). The shell rendered by
// `chat/layout.tsx` shows the ChatLanding composer via its built-in renderMain
// when no `[id]` segment is active, so this index page intentionally returns
// null to keep the layout's children slot empty.
export default function ChatPage() {
  return null;
}
