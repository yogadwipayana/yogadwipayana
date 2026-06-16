import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  computeBranchInfo,
  getMessages,
  resolveBranchLeaf,
  setActiveLeaf,
} from "@/lib/server/chat-service";
import { listGeneratedImages } from "@/lib/server/image-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; messageId: string }> };

/**
 * POST /api/conversations/:id/messages/:messageId/activate
 *
 * Switches the conversation's active path to the branch passing through the
 * given sibling message. The server descends from that sibling to its deepest
 * leaf and sets it as the active leaf, so the whole branch renders. Re-renders
 * without generating anything.
 *
 * Returns the new active path (+ branch info + images) so the client can
 * re-render directly.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, messageId } = await params;

  // Descend the chosen sibling to its leaf so the entire branch is shown, then
  // make that leaf active.
  const leaf = await resolveBranchLeaf(supabase, id, user.id, messageId);
  if (!leaf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ok = await setActiveLeaf(supabase, id, user.id, leaf);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // listChildren under each path message gives the navigator counts; compute it
  // from the full row set the same way GET does. The full-row query is
  // independent of the path/image fetches, so run all three in parallel.
  const [rawMessages, imagesResult, allRowsResult] = await Promise.all([
    getMessages(supabase, id, user.id),
    listGeneratedImages(supabase, user.id, { conversationId: id }),
    supabase
      .from("message")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const { data: allRows } = allRowsResult;
  const branchInfo = computeBranchInfo(allRows ?? [], rawMessages);

  const messages = rawMessages.map((m) => {
    const info = branchInfo.get(m.id);
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.created_at,
      parentId: m.parent_message_id ?? null,
      ...(info && info.count > 1
        ? { branchIndex: info.index, branchCount: info.count, siblingIds: info.siblingIds }
        : {}),
      ...(m.tool_events?.length ? { toolEvents: m.tool_events } : {}),
      ...(m.follow_ups?.length ? { followUps: m.follow_ups } : {}),
      ...(m.stopped_reason ? { stoppedReason: m.stopped_reason } : {}),
    };
  });

  return NextResponse.json({ messages, images: imagesResult.images });
}
