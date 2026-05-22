import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

import {
  getConversationByShareToken,
  listMessagesByConversationId,
} from "@/lib/server/chat-service";
import { ShareView } from "./share-view";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  const conversation = await getConversationByShareToken(supabase, token);
  if (!conversation) {
    return { title: "Shared chat · Not found" };
  }
  return {
    title: `${conversation.title} · Shared chat`,
    description: `A shared conversation from Yoga Dwipayana Chat — model: ${conversation.model}.`,
  };
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;

  // Use the publishable key directly so this page works for unauthenticated visitors.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  const conversation = await getConversationByShareToken(supabase, token);
  if (!conversation || !conversation.is_public) {
    notFound();
  }

  const messages = await listMessagesByConversationId(supabase, conversation.id);

  return (
    <ShareView
      title={conversation.title}
      model={conversation.model}
      updatedAt={conversation.updated_at}
      messages={messages.filter((m) => m.role !== "system")}
    />
  );
}
