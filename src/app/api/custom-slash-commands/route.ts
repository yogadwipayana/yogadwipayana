import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createCustomSlashCommand,
  listCustomSlashCommands,
} from "@/lib/server/custom-slash-command-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

// `trigger` must match the parser regex in slash-commands.ts (lowercase a-z).
const CreateBody = z.object({
  trigger: z.string().trim().toLowerCase().regex(/^[a-z]+$/, "Use lowercase letters only").max(32),
  description: z.string().trim().max(200).optional().default(""),
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

  const commands = await listCustomSlashCommands(supabase, user.id);
  return NextResponse.json({ commands });
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

  // Reject triggers that collide with built-in commands — built-ins always win,
  // so a custom one with the same name would silently never fire.
  if (BUILTIN_TRIGGERS.has(parsed.data.trigger)) {
    return NextResponse.json(
      { error: `"/${parsed.data.trigger}" is a built-in command` },
      { status: 409 },
    );
  }

  try {
    const command = await createCustomSlashCommand(supabase, {
      userId: user.id,
      trigger: parsed.data.trigger,
      description: parsed.data.description,
      content: parsed.data.content,
    });
    return NextResponse.json({ command }, { status: 201 });
  } catch (err) {
    // Unique violation on (user_id, lower(trigger)).
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: `"/${parsed.data.trigger}" already exists` },
        { status: 409 },
      );
    }
    throw err;
  }
}

const BUILTIN_TRIGGERS = new Set(["summarize", "diagram", "word"]);

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
