import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getConversation } from "@/lib/server/chat-service";
import { getGeneration } from "@/lib/server/chat-registry";
import { streamResponse } from "@/lib/server/chat-stream";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/conversations/:id/stream
 *
 * Re-attach to an in-flight generation. When the user refreshes the page or
 * opens the conversation in a new tab while the assistant is still generating,
 * the client probes this endpoint: if a generation is active in the server
 * registry, we replay the buffered frames and then stream live deltas — exactly
 * as if the client had never disconnected. If nothing is running, returns 204
 * so the client falls back to loading the persisted messages from the DB.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Ownership check before exposing any generation state.
  const conversation = await getConversation(supabase, conversationId, user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gen = getGeneration(conversationId);
  if (!gen) {
    // No active or recently-finished generation to attach to.
    return new NextResponse(null, { status: 204 });
  }

  return streamResponse(gen);
}
