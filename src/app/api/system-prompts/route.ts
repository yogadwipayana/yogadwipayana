import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSystemPrompt,
  listSystemPrompts,
} from "@/lib/server/system-prompt-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(20_000),
});

export async function GET() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prompts = await listSystemPrompts(supabase, user.id);
  return NextResponse.json({ prompts });
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

  const prompt = await createSystemPrompt(supabase, {
    userId: user.id,
    name: parsed.data.name,
    content: parsed.data.content,
  });
  return NextResponse.json({ prompt }, { status: 201 });
}
