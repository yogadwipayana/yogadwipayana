import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateImage as runGenerator,
  type GenerateImageOptions,
} from "@/lib/server/image-gen";

export type GeneratedImageSource = "chat" | "workspace" | "admin";

export type GeneratedImageRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  url: string;
  prompt: string;
  model: string;
  size: string | null;
  source_url: string | null;
  source: GeneratedImageSource;
  created_at: string;
};

const ROW_COLS =
  "id,user_id,conversation_id,url,prompt,model,size,source_url,source,created_at";

/**
 * Generate an image and persist it to `generated_image` so it appears in the
 * gallery / workspace history. Wraps `generateImage` from image-gen.ts.
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
      model: "cx/gpt-5.4-image",
      size: options?.size ?? null,
      source_url: options?.image ?? null,
      source,
    })
    .select(ROW_COLS)
    .single<GeneratedImageRow>();
  if (error) throw error;
  return data;
}

export async function listGeneratedImages(
  supabase: SupabaseClient,
  userId: string,
  opts?: { conversationId?: string; limit?: number; before?: string },
): Promise<GeneratedImageRow[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 60));
  let q = supabase
    .from("generated_image")
    .select(ROW_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.conversationId) {
    q = q.eq("conversation_id", opts.conversationId);
  }
  if (opts?.before) {
    q = q.lt("created_at", opts.before);
  }

  const { data, error } = await q.returns<GeneratedImageRow[]>();
  if (error) throw error;
  return data ?? [];
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
