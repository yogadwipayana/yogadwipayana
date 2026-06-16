import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/server/api-response";
import {
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
} from "@/lib/server/memory-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const memories = await listMemories(supabase, user.id);
    return NextResponse.json({ memories });
  } catch (err) {
    return fail(err);
  }
}

const PostBody = z.object({
  content: z.string().trim().min(1).max(2_000),
});

export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const memory = await createMemory(supabase, user.id, {
      content: parsed.data.content,
      source: "manual",
    });
    return NextResponse.json({ memory });
  } catch (err) {
    return fail(err);
  }
}

const PatchBody = z
  .object({
    id: z.uuid(),
    content: z.string().trim().min(1).max(2_000).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((d) => d.content !== undefined || d.is_active !== undefined, {
    message: "Provide content or is_active to update",
  });

export async function PATCH(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const memory = await updateMemory(supabase, user.id, parsed.data.id, {
      content: parsed.data.content,
      is_active: parsed.data.is_active,
    });
    if (!memory) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ memory });
  } catch (err) {
    return fail(err);
  }
}

const DeleteQuery = z.object({ id: z.uuid() });

export async function DELETE(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = DeleteQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const ok = await deleteMemory(supabase, user.id, parsed.data.id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return fail(err);
  }
}
