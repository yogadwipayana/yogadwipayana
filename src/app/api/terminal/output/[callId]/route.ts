import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveTerminalOutput } from "@/lib/server/terminal-output-store";
import { createClient } from "@/utils/supabase/server";

const MAX_OUTPUT_CHARS = 100_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await params;
  const body = (await req.json()) as {
    output?: string;
    exitCode?: number | null;
    truncated?: boolean;
  };

  let output = typeof body.output === "string" ? body.output : "";
  let truncated = body.truncated === true;
  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(-MAX_OUTPUT_CHARS);
    truncated = true;
  }

  resolveTerminalOutput(callId, {
    output,
    exitCode:
      typeof body.exitCode === "number" ? body.exitCode : null,
    truncated,
  });

  return NextResponse.json({ ok: true });
}
