import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getConversation,
  setConversationShare,
} from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function buildShareUrl(token: string | null): string | null {
  if (!token) return null;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/chat/share/${token}`;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await getConversation(supabase, id, user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    conversation,
    share_url: conversation.is_public ? buildShareUrl(conversation.share_token) : null,
  });
}

const PostBody = z.object({
  make_public: z.boolean(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const conversation = await setConversationShare(
    supabase,
    id,
    user.id,
    parsed.data.make_public,
  );
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    conversation,
    share_url: conversation.is_public ? buildShareUrl(conversation.share_token) : null,
  });
}
