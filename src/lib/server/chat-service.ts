import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type ConversationSummary = Pick<
  ConversationRow,
  "id" | "title" | "model" | "updated_at"
>;

const SUMMARY_COLS = "id,title,model,updated_at";

export async function listConversations(
  supabase: SupabaseClient,
): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversation")
    .select(SUMMARY_COLS)
    .order("updated_at", { ascending: false })
    .returns<ConversationSummary[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getConversation(
  supabase: SupabaseClient,
  id: string,
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversation")
    .select("*")
    .eq("id", id)
    .maybeSingle<ConversationRow>();
  if (error) throw error;
  return data;
}

export async function getMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("message")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createConversation(
  supabase: SupabaseClient,
  args: { userId: string; model: string; title?: string },
): Promise<ConversationSummary> {
  const { data, error } = await supabase
    .from("conversation")
    .insert({
      user_id: args.userId,
      model: args.model,
      ...(args.title ? { title: args.title } : {}),
    })
    .select(SUMMARY_COLS)
    .single<ConversationSummary>();
  if (error) throw error;
  return data;
}

export async function appendMessage(
  supabase: SupabaseClient,
  args: {
    conversationId: string;
    role: MessageRow["role"];
    content: string;
  },
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from("message")
    .insert({
      conversation_id: args.conversationId,
      role: args.role,
      content: args.content,
    })
    .select("*")
    .single<MessageRow>();
  if (error) throw error;
  return data;
}

export async function updateConversation(
  supabase: SupabaseClient,
  id: string,
  patch: { title?: string; model?: string },
): Promise<ConversationSummary | null> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) fields.title = patch.title;
  if (patch.model !== undefined) fields.model = patch.model;

  const { data, error } = await supabase
    .from("conversation")
    .update(fields)
    .eq("id", id)
    .select(SUMMARY_COLS)
    .maybeSingle<ConversationSummary>();
  if (error) throw error;
  return data;
}

export async function touchConversation(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversation")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export function deriveTitle(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 50) return cleaned;
  const cut = cleaned.slice(0, 50);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + "…";
}
