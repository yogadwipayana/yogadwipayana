import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeAspectInput, presetToSize } from "@/lib/aspect-ratio";
import {
  deleteGeneratedImage,
  generateAndRecord,
  listGeneratedImages,
} from "@/lib/server/image-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const PostBody = z.object({
  prompt: z.string().min(1).max(4_000),
  aspect_ratio: z
    .enum(["auto", "square", "portrait", "landscape", "wide", "tall"])
    .optional(),
  /** Free-form size, accepted for backwards compatibility. */
  size: z.string().min(1).max(20).optional(),
  /** Reference image URL for edit / image-to-image workflows. */
  image_url: z.string().url().optional(),
  conversation_id: z.string().uuid().optional(),
  source: z.enum(["chat", "workspace", "admin"]).optional(),
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

  const { prompt, aspect_ratio, size, image_url, conversation_id, source } =
    parsed.data;

  // Resolve to a canonical size: prefer the preset, fall back to the legacy
  // free-form `size`, then to "auto".
  const resolvedSize = aspect_ratio
    ? presetToSize(aspect_ratio)
    : size
      ? presetToSize(normalizeAspectInput(size))
      : presetToSize("auto");

  try {
    const row = await generateAndRecord({
      supabase,
      userId: user.id,
      prompt,
      conversationId: conversation_id ?? null,
      source: source ?? "workspace",
      options: {
        prompt,
        size: resolvedSize,
        image: image_url,
        abortSignal: request.signal,
      },
    });
    return NextResponse.json({ image: row });
  } catch (err) {
    if (err instanceof Error && err.message.includes("aborted")) {
      return NextResponse.json({ error: "Cancelled" }, { status: 499 });
    }
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[/api/images] generate failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const ListQuery = z.object({
  conversation_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = ListQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const images = await listGeneratedImages(supabase, user.id, {
    conversationId: parsed.data.conversation_id,
    limit: parsed.data.limit,
    before: parsed.data.before,
  });
  return NextResponse.json({ images });
}

const DeleteQuery = z.object({ id: z.string().uuid() });

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

  const ok = await deleteGeneratedImage(supabase, user.id, parsed.data.id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
