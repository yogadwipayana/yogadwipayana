import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveApproval } from "@/lib/server/terminal-approval-store";
import { createClient } from "@/utils/supabase/server";

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
  const body = (await req.json()) as { approved?: boolean };
  const approved = body.approved === true;

  const found = resolveApproval(callId, approved);
  if (!found) {
    return NextResponse.json(
      { error: "No pending approval found for this call ID" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, approved });
}
