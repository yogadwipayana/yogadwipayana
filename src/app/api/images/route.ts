import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeAspectInput, presetToSize } from "@/lib/aspect-ratio";
import { fail } from "@/lib/server/api-response";
import {
  deleteGeneratedImage,
  generateAndRecord,
  listGeneratedImages,
} from "@/lib/server/image-service";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { validatePublicHttpUrl } from "@/lib/server/safe-fetch";
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
  /** Single reference image — legacy / chat usage. */
  image_url: z.string().min(1).max(2048).optional(),
  /** Multiple reference images from the workspace (up to 4). */
  image_urls: z.array(z.string().min(1).max(2048)).max(4).optional(),
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

  const { prompt, aspect_ratio, size, image_url, image_urls, conversation_id, source } =
    parsed.data;

  // Merge image_url (legacy/chat) and image_urls (workspace) into one list,
  // then resolve each: local paths -> base64 data URL, remote URLs -> SSRF-checked.
  async function resolveOne(raw: string): Promise<string | { error: string }> {
    if (raw.startsWith("/generated-images/")) {
      const safeName = raw.replace(/\.\./g, "").replace(/^\/+/, "");
      const filePath = join(process.cwd(), "public", safeName);
      try {
        const buf = await readFile(filePath);
        return `data:image/png;base64,${buf.toString("base64")}`;
      } catch {
        return { error: "Reference image not found" };
      }
    }
    const validation = await validatePublicHttpUrl(raw);
    if (!validation.ok) return { error: `image_url rejected: ${validation.error}` };
    return raw;
  }

  const rawUrls = [
    ...(image_url ? [image_url] : []),
    ...(image_urls ?? []),
  ].slice(0, 4);

  const resolvedImages: string[] = [];
  for (const raw of rawUrls) {
    const result = await resolveOne(raw);
    if (typeof result !== "string") {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    resolvedImages.push(result);
  }

  try {
    const id = getRateLimitIdentifier(user.id, getClientIp(request.headers));
    await checkRateLimit(ratelimits.imageGen, id, "image generation");
    await checkRateLimit(ratelimits.imageGenDaily, id, "image generation daily");
  } catch (err) {
    return fail(err);
  }

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
        // Single image kept for API compat; multi-image uses images[]
        image: resolvedImages[0],
        images: resolvedImages.length > 1 ? resolvedImages : undefined,
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
