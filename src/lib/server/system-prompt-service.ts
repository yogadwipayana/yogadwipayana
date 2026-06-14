import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A reusable system-prompt block owned by a user. When attached to a
 * conversation (conversation.system_prompt_id), its `content` is injected as an
 * extra `system` message after the base CHAT_SYSTEM_PROMPT so the assistant
 * follows the user's custom instructions on top of the app defaults.
 */
export type SystemPromptRow = {
  id: string;
  user_id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type SystemPromptSummary = Pick<
  SystemPromptRow,
  "id" | "name" | "content" | "created_at" | "updated_at"
>;

const COLS = "id,name,content,created_at,updated_at";

export async function listSystemPrompts(
  supabase: SupabaseClient,
  userId: string,
): Promise<SystemPromptSummary[]> {
  const { data, error } = await supabase
    .from("system_prompt")
    .select(COLS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .returns<SystemPromptSummary[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getSystemPrompt(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<SystemPromptSummary | null> {
  const { data, error } = await supabase
    .from("system_prompt")
    .select(COLS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<SystemPromptSummary>();
  if (error) throw error;
  return data;
}

export async function createSystemPrompt(
  supabase: SupabaseClient,
  args: { userId: string; name: string; content: string },
): Promise<SystemPromptSummary> {
  const { data, error } = await supabase
    .from("system_prompt")
    .insert({
      user_id: args.userId,
      name: args.name,
      content: args.content,
    })
    .select(COLS)
    .single<SystemPromptSummary>();
  if (error) throw error;
  return data;
}

export async function updateSystemPrompt(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  patch: { name?: string; content?: string },
): Promise<SystemPromptSummary | null> {
  const fields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.content !== undefined) fields.content = patch.content;

  const { data, error } = await supabase
    .from("system_prompt")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId)
    .select(COLS)
    .maybeSingle<SystemPromptSummary>();
  if (error) throw error;
  return data;
}

export async function deleteSystemPrompt(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<boolean> {
  // Returning the row tells us whether RLS + ownership matched. The FK on
  // conversation.system_prompt_id is `on delete set null`, so any conversations
  // using this prompt are detached rather than deleted.
  const { data, error } = await supabase
    .from("system_prompt")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}

/**
 * Resolves the system-prompt content attached to a conversation, or null when
 * the conversation has none / the referenced prompt was deleted. Uses two plain
 * queries instead of a PostgREST embedded join: the FK is added by a migration
 * that may post-date PostgREST's schema-cache load, and an embed against an
 * unknown relationship fails silently (returns null) — two direct selects have
 * no such dependency and stay owner-scoped via RLS.
 */
export async function getConversationSystemPromptContent(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<string | null> {
  const { data: conv, error: convErr } = await supabase
    .from("conversation")
    .select("system_prompt_id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<{ system_prompt_id: string | null }>();
  if (convErr) throw convErr;
  if (!conv?.system_prompt_id) return null;

  const prompt = await getSystemPrompt(supabase, conv.system_prompt_id, userId);
  const content = prompt?.content;
  return content && content.trim().length > 0 ? content : null;
}
