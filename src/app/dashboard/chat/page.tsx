import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEFAULT_MODEL } from "@/lib/openai";
import { listConversations } from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

import { DashboardShell } from "../shell";

export const metadata: Metadata = {
  title: "Chat AI · Dashboard",
  description: "Conversations powered by your AI router.",
};

export default async function ChatPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const conversations = await listConversations(supabase);

  return (
    <DashboardShell
      toolId="chat"
      chatConversations={conversations}
      defaultChatModel={DEFAULT_MODEL}
    />
  );
}
