// /dashboard/chat/gallery. Static route takes precedence over the sibling [id]
// dynamic segment, so the shell's renderMain shows the Gallery view instead of
// loading "gallery" as a conversation id. Returns null — chat content is
// URL-segment-driven through the shell.
export default function ChatGalleryPage() {
  return null;
}
