import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateDocx as runGenerator,
  type GenerateDocxOptions,
} from "@/lib/server/docx-gen";

export type GeneratedDocumentSource = "chat" | "workspace" | "admin";

export type GeneratedDocumentRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  url: string;
  title: string;
  prompt: string;
  format: string;
  source: GeneratedDocumentSource;
  created_at: string;
};

const ROW_COLS =
  "id,user_id,conversation_id,url,title,prompt,format,source,created_at";

/**
 * Generate a .docx and persist it to `generated_document` so it shows up in
 * chat history (and any future documents workspace). Wraps `generateDocx`
 * from docx-gen.ts. Mirrors generateAndRecord in image-service.ts.
 */
export async function generateAndRecord(args: {
  supabase: SupabaseClient;
  userId: string;
  prompt: string;
  options: GenerateDocxOptions;
  conversationId?: string | null;
  source: GeneratedDocumentSource;
}): Promise<GeneratedDocumentRow> {
  const { supabase, userId, prompt, options, conversationId, source } = args;
  const result = await runGenerator(options);

  const { data, error } = await supabase
    .from("generated_document")
    .insert({
      user_id: userId,
      conversation_id: conversationId ?? null,
      url: result.url,
      title: result.title,
      prompt,
      format: "docx",
      source,
    })
    .select(ROW_COLS)
    .single<GeneratedDocumentRow>();
  if (error) throw error;
  return data;
}

export async function listGeneratedDocuments(
  supabase: SupabaseClient,
  userId: string,
  opts?: { conversationId?: string; limit?: number; before?: string },
): Promise<GeneratedDocumentRow[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 60));
  let q = supabase
    .from("generated_document")
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

  const { data, error } = await q.returns<GeneratedDocumentRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function deleteGeneratedDocument(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("generated_document")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}
