import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import { z } from "zod";

import { normalizeAspectInput, presetToSize } from "@/lib/aspect-ratio";
import { getObjectBytes, keyFromProxyUrl } from "@/lib/r2";
import { fail } from "@/lib/server/api-response";
import { generateImage } from "@/lib/server/image-gen";
import {
  completeImage,
  createPendingImage,
  deleteGeneratedImage,
  failImage,
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
import { createAdminClient } from "@/utils/supabase/admin";
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
  quality: z.enum(["auto", "hd"]).optional(),
  /** Concepts to steer away from. */
  negative_prompt: z.string().max(2_000).optional(),
  /** "transparent" powers one-click background removal. */
  background: z.enum(["auto", "transparent", "opaque"]).optional(),
  /**
   * Inpaint mask (own-R2 proxy URL or data URL). Transparent areas mark the
   * region to regenerate; requires a single base image in image_url/image_urls.
   */
  mask_url: z.string().min(1).max(2048).optional(),
  conversation_id: z.uuid().optional(),
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

  const {
    prompt,
    aspect_ratio,
    size,
    image_url,
    image_urls,
    quality,
    negative_prompt,
    background,
    mask_url,
    conversation_id,
    source,
  } = parsed.data;

  // Merge image_url (legacy/chat) and image_urls (workspace) into one list,
  // then resolve each: our own R2-backed files -> base64 data URL, remote URLs
  // -> SSRF-checked.
  async function resolveOne(raw: string): Promise<string | { error: string }> {
    const ownKey = keyFromProxyUrl(raw);
    if (ownKey) {
      try {
        const { body, contentType } = await getObjectBytes(ownKey);
        return `data:${contentType ?? "image/png"};base64,${body.toString("base64")}`;
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
  const resolveResults = await Promise.all(rawUrls.map((raw) => resolveOne(raw)));
  for (const result of resolveResults) {
    if (typeof result !== "string") {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    resolvedImages.push(result);
  }

  // Inpainting: resolve the mask through the same own-R2/SSRF pipeline. A mask
  // is meaningless without exactly one base image to edit.
  let resolvedMask: string | undefined;
  if (mask_url) {
    if (resolvedImages.length !== 1) {
      return NextResponse.json(
        { error: "Inpainting requires exactly one base image" },
        { status: 400 },
      );
    }
    const maskResult = await resolveOne(mask_url);
    if (typeof maskResult !== "string") {
      return NextResponse.json({ error: maskResult.error }, { status: 400 });
    }
    resolvedMask = maskResult;
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

  const effectiveSource = source ?? "workspace";

  // Workspace generations run as a background job so they survive the client
  // navigating away or reloading: we insert a `pending` row, return it
  // immediately, and finish generation in after() using a service-role client
  // that isn't tied to this request's lifecycle. The client polls GET to see
  // the row flip to completed/failed.
  if (effectiveSource === "workspace") {
    let pending;
    try {
      pending = await createPendingImage({
        supabase,
        userId: user.id,
        prompt,
        size: resolvedSize,
        sourceUrl: resolvedImages[0] ?? null,
        conversationId: conversation_id ?? null,
        source: effectiveSource,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to queue job";
      console.error("[/api/images] queue failed:", err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const jobId = pending.id;
    after(async () => {
      const admin = createAdminClient();
      try {
        // No abortSignal here on purpose — generation must not be cancelled
        // when the client connection that triggered it goes away.
        const result = await generateImage({
          prompt,
          size: resolvedSize,
          quality: quality ?? "auto",
          image: resolvedImages[0],
          images: resolvedImages.length > 1 ? resolvedImages : undefined,
          negativePrompt: negative_prompt,
          background,
          mask: resolvedMask,
        });
        await completeImage(admin, jobId, result.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        console.error("[/api/images] background generate failed:", err);
        try {
          await failImage(admin, jobId, message);
        } catch (updateErr) {
          console.error("[/api/images] failed to mark job failed:", updateErr);
        }
      }
    });

    return NextResponse.json({ image: pending }, { status: 202 });
  }

  // Chat / admin path: caller awaits the result inline.
  try {
    const row = await generateAndRecord({
      supabase,
      userId: user.id,
      prompt,
      conversationId: conversation_id ?? null,
      source: effectiveSource,
      options: {
        prompt,
        size: resolvedSize,
        quality: quality ?? "auto",
        // Single image kept for API compat; multi-image uses images[]
        image: resolvedImages[0],
        images: resolvedImages.length > 1 ? resolvedImages : undefined,
        negativePrompt: negative_prompt,
        background,
        mask: resolvedMask,
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
  conversation_id: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.iso.datetime().optional(),
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

  const { images, nextCursor, hasMore } = await listGeneratedImages(
    supabase,
    user.id,
    {
      conversationId: parsed.data.conversation_id,
      limit: parsed.data.limit,
      before: parsed.data.before,
    },
  );
  return NextResponse.json({ images, nextCursor, hasMore });
}

const DeleteQuery = z.object({ id: z.uuid() });

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
