import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { fail } from "@/lib/server/api-response";
import { getUsageStats } from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("days"));
  const windowDays = Number.isFinite(raw) ? Math.min(90, Math.max(7, raw)) : 30;

  try {
    const stats = await getUsageStats(supabase, user.id, windowDays);
    return NextResponse.json({ stats });
  } catch (err) {
    return fail(err);
  }
}
