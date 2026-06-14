import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateImage as runGenerator,
  type GenerateImageOptions,
} from "@/lib/server/image-gen";

export type GeneratedImageSource = "chat" | "workspace" | "admin";
export type GeneratedImageStatus = "pending" | "completed" | "failed";

export type GeneratedImageRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  url: string | null;
  prompt: string;
  model: string;
  size: string | null;
  source_url: string | null;
  source: GeneratedImageSource;
  status: GeneratedImageStatus;
  error: string | null;
  created_at: string;
};

const ROW_COLS =
  "id,user_id,conversation_id,url,prompt,model,size,source_url,source,status,error,created_at";

/**
 * Generate an image and persist it to `generated_image` so it appears in the
 * gallery / workspace history. Wraps `generateImage` from image-gen.ts.
 *
 * This is the synchronous path: it blocks until the image is generated and
 * inserts a single completed row. Used by chat/admin where the caller awaits
 * the result inline. The workspace uses the async job path below instead.
 */
export async function generateAndRecord(args: {
  supabase: SupabaseClient;
  userId: string;
  prompt: string;
  options?: GenerateImageOptions;
  conversationId?: string | null;
  source: GeneratedImageSource;
}): Promise<GeneratedImageRow> {
  const { supabase, userId, prompt, options, conversationId, source } = args;
  const result = await runGenerator({ ...(options ?? {}), prompt });

  const { data, error } = await supabase
    .from("generated_image")
    .insert({
      user_id: userId,
      conversation_id: conversationId ?? null,
      url: result.url,
      prompt: result.prompt,
      model: "cx/gpt-5.5-image",
      size: options?.size ?? null,
      source_url: options?.image ?? null,
      source,
      status: "completed",
    })
    .select(ROW_COLS)
    .single<GeneratedImageRow>();
  if (error) throw error;
  return data;
}

/**
 * Insert a `pending` row before generation starts. Returns the row so the
 * caller can respond immediately while generation runs in the background.
 */
export async function createPendingImage(args: {
  supabase: SupabaseClient;
  userId: string;
  prompt: string;
  size?: string | null;
  sourceUrl?: string | null;
  conversationId?: string | null;
  source: GeneratedImageSource;
}): Promise<GeneratedImageRow> {
  const { supabase, userId, prompt, size, sourceUrl, conversationId, source } =
    args;
  const { data, error } = await supabase
    .from("generated_image")
    .insert({
      user_id: userId,
      conversation_id: conversationId ?? null,
      url: null,
      prompt,
      model: "cx/gpt-5.5-image",
      size: size ?? null,
      source_url: sourceUrl ?? null,
      source,
      status: "pending",
    })
    .select(ROW_COLS)
    .single<GeneratedImageRow>();
  if (error) throw error;
  return data;
}

/** Mark a pending row completed with its generated image URL. */
export async function completeImage(
  supabase: SupabaseClient,
  id: string,
  url: string,
): Promise<void> {
  const { error } = await supabase
    .from("generated_image")
    .update({ url, status: "completed", error: null })
    .eq("id", id);
  if (error) throw error;
}

/** Mark a pending row failed with an error message. */
export async function failImage(
  supabase: SupabaseClient,
  id: string,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("generated_image")
    .update({ status: "failed", error: message.slice(0, 500) })
    .eq("id", id);
  if (error) throw error;
}

export type ListGeneratedImagesResult = {
  images: GeneratedImageRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function listGeneratedImages(
  supabase: SupabaseClient,
  userId: string,
  opts?: { conversationId?: string; limit?: number; before?: string },
): Promise<ListGeneratedImagesResult> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 60));
  // Over-fetch by one to detect whether more rows exist past this page without
  // a second count query.
  let q = supabase
    .from("generated_image")
    .select(ROW_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (opts?.conversationId) {
    q = q.eq("conversation_id", opts.conversationId);
  }
  if (opts?.before) {
    q = q.lt("created_at", opts.before);
  }

  const { data, error } = await q.returns<GeneratedImageRow[]>();
  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const images = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? images[images.length - 1].created_at : null;
  return { images, nextCursor, hasMore };
}

export async function deleteGeneratedImage(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("generated_image")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}
