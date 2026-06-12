import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getConversation } from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/sign-in?next=/dashboard/chat/${id}`);
  }

  // Validate ownership before the shell mounts a ChatView for this id. A
  // freshly-created conversation (deferred-creation handoff) is already in the
  // DB by the time we navigate here, so this resolves for the happy path and
  // 404s only on stale/foreign ids.
  const conversation = await getConversation(supabase, id, user.id);
  if (!conversation) {
    notFound();
  }

  // The shell's renderMain mounts the ChatView from the URL's `[id]` segment,
  // so this page contributes no children of its own.
  return null;
}
