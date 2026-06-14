import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteSystemPrompt,
  updateSystemPrompt,
} from "@/lib/server/system-prompt-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const PatchBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(20_000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.name === undefined && parsed.data.content === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const prompt = await updateSystemPrompt(supabase, id, user.id, parsed.data);
  if (!prompt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ prompt });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteSystemPrompt(supabase, id, user.id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
