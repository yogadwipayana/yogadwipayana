import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_MODEL } from "@/lib/openai";
import {
  createConversation,
  listConversations,
} from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const CreateBody = z.object({
  model: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(200).optional(),
});

export async function GET() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listConversations(supabase, user.id);
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const conversation = await createConversation(supabase, {
    userId: user.id,
    model: parsed.data.model ?? DEFAULT_MODEL,
    title: parsed.data.title,
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
