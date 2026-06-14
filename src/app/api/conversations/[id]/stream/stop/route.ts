import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getConversation } from "@/lib/server/chat-service";
import { stopGeneration } from "@/lib/server/chat-registry";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/conversations/:id/stream/stop
 *
 * Explicitly stop an in-flight generation. Generations are no longer killed by
 * client disconnect (that's the whole point of background generation), so the
 * Stop button needs a dedicated signal: this aborts the registry generation's
 * internal AbortController, which the model loop checks each round/chunk. The
 * partial assistant text generated so far is still persisted.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const conversation = await getConversation(supabase, conversationId, user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stopped = stopGeneration(conversationId);
  return NextResponse.json({ stopped });
}
