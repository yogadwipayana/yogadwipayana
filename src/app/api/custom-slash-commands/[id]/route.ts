import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteCustomSlashCommand,
  updateCustomSlashCommand,
} from "@/lib/server/custom-slash-command-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const BUILTIN_TRIGGERS = new Set(["summarize", "diagram", "word"]);

const PatchBody = z.object({
  trigger: z.string().trim().toLowerCase().regex(/^[a-z]+$/, "Use lowercase letters only").max(32).optional(),
  description: z.string().trim().max(200).optional(),
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

  const [{ id }, json] = await Promise.all([
    params,
    request.json().catch(() => ({})),
  ]);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (
    parsed.data.trigger === undefined &&
    parsed.data.description === undefined &&
    parsed.data.content === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (parsed.data.trigger && BUILTIN_TRIGGERS.has(parsed.data.trigger)) {
    return NextResponse.json(
      { error: `"/${parsed.data.trigger}" is a built-in command` },
      { status: 409 },
    );
  }

  try {
    const command = await updateCustomSlashCommand(supabase, id, user.id, parsed.data);
    if (!command) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ command });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: `"/${parsed.data.trigger}" already exists` },
        { status: 409 },
      );
    }
    throw err;
  }
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
  const ok = await deleteCustomSlashCommand(supabase, id, user.id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
