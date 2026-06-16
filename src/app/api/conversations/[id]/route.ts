import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  computeBranchInfo,
  deleteConversation,
  getConversation,
  getMessages,
  updateConversation,
} from "@/lib/server/chat-service";
import { TOOL_CATEGORY_KEYS } from "@/lib/server/chat-tools";
import { listGeneratedImages } from "@/lib/server/image-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const PatchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  model: z.string().min(1).max(120).optional(),
  mode: z.enum(["chat", "image"]).optional(),
  // `null` detaches the prompt; a uuid attaches one. Omitted = leave unchanged.
  system_prompt_id: z.uuid().nullable().optional(),
  // Tool categories switched off for this conversation (see TOOL_CATEGORY_KEYS).
  disabled_tools: z.array(z.enum(TOOL_CATEGORY_KEYS)).optional(),
  // Organizational state — does not bump updated_at / reorder the list.
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await getConversation(supabase, id, user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [rawMessages, imagesResult] = await Promise.all([
    getMessages(supabase, id, user.id),
    listGeneratedImages(supabase, user.id, { conversationId: id }),
  ]);
  const images = imagesResult.images;

  // Branch-navigator metadata: count siblings for each message on the active
  // path. Computed from the full row set (the active path alone can't see
  // siblings on other branches).
  const { data: allRows } = await supabase
    .from("message")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  const branchInfo = computeBranchInfo(allRows ?? [], rawMessages);

  // Rename snake_case DB columns to camelCase for the frontend ChatMessage type.
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
  return NextResponse.json({ conversation, messages, images });
}

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
    parsed.data.title === undefined &&
    parsed.data.model === undefined &&
    parsed.data.mode === undefined &&
    parsed.data.system_prompt_id === undefined &&
    parsed.data.disabled_tools === undefined &&
    parsed.data.pinned === undefined &&
    parsed.data.archived === undefined
  ) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 },
    );
  }

  const conversation = await updateConversation(supabase, id, user.id, {
    title: parsed.data.title,
    model: parsed.data.model,
    mode: parsed.data.mode,
    systemPromptId: parsed.data.system_prompt_id,
    disabledTools: parsed.data.disabled_tools,
    pinned: parsed.data.pinned,
    archived: parsed.data.archived,
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
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
  const ok = await deleteConversation(supabase, id, user.id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
