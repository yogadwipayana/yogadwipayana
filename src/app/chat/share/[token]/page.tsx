import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/utils/supabase/server";
import {
  getConversationByShareToken,
  listMessagesByConversationId,
} from "@/lib/server/chat-service";
import { Footer } from "@/components/layout/Footer";
import { Logo } from "@/components/ui/Logo";
import { Transcript, type PublicMessage } from "./Transcript";

type PageProps = {
  params: Promise<{ token: string }>;
};

async function loadShared(token: string) {
  const supabase = createClient(await cookies());
  const conversation = await getConversationByShareToken(supabase, token);
  if (!conversation) return null;
  const rows = await listMessagesByConversationId(supabase, conversation.id);
  const messages: PublicMessage[] = rows
    .filter((m) => m.role !== "system")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  return { conversation, messages };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const shared = await loadShared(token);
  if (!shared) {
    return { title: "Shared conversation", robots: { index: false } };
  }
  return {
    title: shared.conversation.title,
    description: `A shared conversation from Chat AI · ${shared.conversation.model}`,
    robots: { index: false },
  };
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  const shared = await loadShared(token);
  if (!shared) notFound();

  const { conversation, messages } = shared;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#1c1c1c]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[760px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em] text-white"
          >
            <span
              aria-hidden
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-white/[0.04]"
            >
              <Logo className="h-4 w-4" />
            </span>
            yoga
          </Link>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/40">
            Shared conversation
          </span>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-6">
          <div className="border-b border-white/[0.08] pb-6">
            <h1 className="text-2xl font-medium tracking-[-0.01em] text-white">
              {conversation.title}
            </h1>
            <p className="mt-2 text-[13px] text-white/40">
              {conversation.model}
              <span className="px-2 text-white/20">·</span>
              read-only
            </p>
          </div>

          {messages.length === 0 ? (
            <p className="mt-10 text-center text-[14px] text-white/40">
              This conversation has no messages yet.
            </p>
          ) : (
            <div className="mt-6">
              <Transcript messages={messages} />
            </div>
          )}

          <div className="mt-12 flex flex-col items-center gap-3 border-t border-white/[0.08] pt-8 text-center">
            <p className="text-[14px] text-white/55">
              This is a read-only snapshot shared from Chat AI.
            </p>
            <Link
              href="/tools"
              className="text-[13px] text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
            >
              Explore the tools →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
