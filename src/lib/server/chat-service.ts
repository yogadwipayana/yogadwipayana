import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveConversationTitle } from "@/lib/chat-title";

export { deriveConversationTitle as deriveTitle };

export type ConversationMode = "chat" | "image";

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  model: string;
  mode: ConversationMode;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  /** Tool call results for the assistant turn (null for user/system rows). */
  tool_events?: Array<{ call_id: string; name: string; status: "done"; args?: unknown; result?: unknown }> | null;
  /** Follow-up question suggestions generated after the assistant turn. */
  follow_ups?: string[] | null;
};

export type ConversationSummary = Pick<
  ConversationRow,
  "id" | "title" | "model" | "mode" | "is_public" | "share_token" | "updated_at"
>;

/** A history entry trimmed down to what the model actually receives. */
export type ModelHistoryMessage = { role: "user" | "assistant"; content: string };

// Sliding-window budget for prior conversation history, in tokens. The model's
// own context window is the hard ceiling (input + output share it), so we keep
// history under this to leave headroom for the system prompts, the new user
// turn, and the completion. Configurable via CHAT_HISTORY_TOKEN_BUDGET;
// defaults to 112k, which leaves ~16k of room inside a 128k-window model.
const DEFAULT_HISTORY_TOKEN_BUDGET = 112_000;
// Rough chars-per-token estimate. English/code averages ~4; we use it so we
// never need to load a real tokenizer just to decide what to drop.
const CHARS_PER_TOKEN = 4;

function historyTokenBudget(): number {
  const raw = Number(process.env.CHAT_HISTORY_TOKEN_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HISTORY_TOKEN_BUDGET;
}

/**
 * Keep only the most recent messages that fit within the history token budget,
 * dropping the oldest first. This is a sliding window: the app has no model-side
 * context management, so without this a long conversation eventually overflows
 * the model's window and the request errors out.
 *
 * The newest message is always kept, even if it alone exceeds the budget, so a
 * single huge turn degrades to "just that turn" rather than to an empty array.
 * Token counts are estimated from character length (CHARS_PER_TOKEN) — exact
 * enough to decide what to drop without pulling in a tokenizer.
 */
export function applyHistoryWindow(
  messages: ModelHistoryMessage[],
  tokenBudget = historyTokenBudget(),
): ModelHistoryMessage[] {
  if (messages.length === 0) return messages;

  const charBudget = tokenBudget * CHARS_PER_TOKEN;
  const kept: ModelHistoryMessage[] = [];
  let usedChars = 0;

  // Walk newest → oldest, accumulating until the next message would overflow.
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = messages[i].content.length;
    if (kept.length > 0 && usedChars + cost > charBudget) break;
    kept.push(messages[i]);
    usedChars += cost;
  }

  kept.reverse(); // restore chronological order
  return kept;
}

// `chat_mode` is aliased to `mode` here because Postgres has a built-in
// `mode()` ordered-set aggregate that PostgREST otherwise mistakes the column
// name for, raising 42809 ("WITHIN GROUP is required for ordered-set aggregate
// mode"). The column is `chat_mode` on the row and `mode` on the wire.
const SUMMARY_COLS = "id,title,model,mode:chat_mode,is_public,share_token,updated_at";
const ROW_COLS = "id,user_id,title,model,mode:chat_mode,is_public,share_token,created_at,updated_at";

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversation")
    .select(SUMMARY_COLS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .returns<ConversationSummary[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getConversation(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversation")
    .select(ROW_COLS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<ConversationRow>();
  if (error) throw error;
  return data;
}

export async function getMessages(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<MessageRow[]> {
  // Confirm the caller owns this conversation before returning messages.
  // Belt-and-braces against RLS drift; we already filtered the parent select
  // in `getConversation`, but route handlers sometimes call `getMessages`
  // directly.
  const owner = await getConversation(supabase, conversationId, userId);
  if (!owner) return [];

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
  args: { userId: string; model: string; mode?: ConversationMode; title?: string },
): Promise<ConversationSummary> {
  const { data, error } = await supabase
    .from("conversation")
    .insert({
      user_id: args.userId,
      model: args.model,
      ...(args.mode ? { chat_mode: args.mode } : {}),
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
    userId: string;
    role: MessageRow["role"];
    content: string;
    toolEvents?: MessageRow["tool_events"];
    followUps?: string[] | null;
  },
): Promise<MessageRow> {
  const owner = await getConversation(supabase, args.conversationId, args.userId);
  if (!owner) {
    throw new Error("Conversation not found");
  }
  const { data, error } = await supabase
    .from("message")
    .insert({
      conversation_id: args.conversationId,
      role: args.role,
      content: args.content,
      ...(args.toolEvents?.length ? { tool_events: args.toolEvents } : {}),
      ...(args.followUps?.length ? { follow_ups: args.followUps } : {}),
    })
    .select("*")
    .single<MessageRow>();
  if (error) throw error;
  return data;
}

export async function updateConversation(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  patch: { title?: string; model?: string; mode?: ConversationMode },
): Promise<ConversationSummary | null> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) fields.title = patch.title;
  if (patch.model !== undefined) fields.model = patch.model;
  if (patch.mode !== undefined) fields.chat_mode = patch.mode;

  const { data, error } = await supabase
    .from("conversation")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId)
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

export async function deleteConversation(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<boolean> {
  // Returning the row tells us whether RLS + ownership matched. If nothing
  // came back the caller doesn't own the row (or it doesn't exist).
  const { data, error } = await supabase
    .from("conversation")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}

export async function deleteLastAssistantMessage(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const owner = await getConversation(supabase, conversationId, userId);
  if (!owner) return false;

  const { data: latest, error: selectErr } = await supabase
    .from("message")
    .select("id,role")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; role: MessageRow["role"] }>();
  if (selectErr) throw selectErr;
  if (!latest || latest.role !== "assistant") return false;

  const { error: deleteErr } = await supabase
    .from("message")
    .delete()
    .eq("id", latest.id);
  if (deleteErr) throw deleteErr;
  return true;
}

/**
 * Toggles the public share state of a conversation.
 * - makePublic=true: generates a share_token if none exists, sets is_public=true.
 * - makePublic=false: sets is_public=false but keeps the token so re-publishing
 *   returns the same URL.
 * Always filters by user_id so non-owners cannot publish.
 */
export async function setConversationShare(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  makePublic: boolean,
): Promise<ConversationRow | null> {
  // Read current row to check for an existing token (owner-gated via RLS).
  const current = await getConversation(supabase, id, userId);
  if (!current) return null;

  const fields: Record<string, unknown> = {
    is_public: makePublic,
    updated_at: new Date().toISOString(),
  };
  if (makePublic && !current.share_token) {
    fields.share_token = crypto.randomUUID();
  }

  const { data, error } = await supabase
    .from("conversation")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId)
    .select(ROW_COLS)
    .maybeSingle<ConversationRow>();
  if (error) throw error;
  return data;
}

/**
 * Looks up a conversation by its public share token.
 * Does NOT filter by user_id — relies on the RLS public-read policy.
 * Returns null when the token doesn't exist or the conversation is not public.
 */
export async function getConversationByShareToken(
  supabase: SupabaseClient,
  token: string,
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversation")
    .select(ROW_COLS)
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle<ConversationRow>();
  if (error) throw error;
  return data;
}

/**
 * Lists all messages for a conversation without an ownership check.
 * Safe to call only after confirming the conversation is public (e.g. via
 * getConversationByShareToken), or when the caller already holds a verified
 * ConversationRow. RLS on the message table enforces the public-read policy.
 */
export async function listMessagesByConversationId(
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

/**
 * Edits an existing user message in place and deletes every message that came
 * after it (the conversation tail), so the model can regenerate from this
 * point. Returns the updated message (or `null` if not found / not owned).
 */
export async function editUserMessageAndTruncate(
  supabase: SupabaseClient,
  args: {
    conversationId: string;
    userId: string;
    messageId: string;
    content: string;
  },
): Promise<MessageRow | null> {
  const owner = await getConversation(supabase, args.conversationId, args.userId);
  if (!owner) return null;

  const { data: target, error: targetErr } = await supabase
    .from("message")
    .select("*")
    .eq("id", args.messageId)
    .eq("conversation_id", args.conversationId)
    .maybeSingle<MessageRow>();
  if (targetErr) throw targetErr;
  if (!target || target.role !== "user") return null;

  // Drop everything strictly after this message (assistant reply + any later
  // turns). Tied timestamps would be unusual but exclude the target itself by
  // id just in case.
  const { error: deleteErr } = await supabase
    .from("message")
    .delete()
    .eq("conversation_id", args.conversationId)
    .gt("created_at", target.created_at);
  if (deleteErr) throw deleteErr;

  const { data: updated, error: updateErr } = await supabase
    .from("message")
    .update({ content: args.content })
    .eq("id", target.id)
    .select("*")
    .single<MessageRow>();
  if (updateErr) throw updateErr;
  return updated;
}
