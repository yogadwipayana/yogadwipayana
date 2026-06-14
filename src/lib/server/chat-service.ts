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
  system_prompt_id: string | null;
  disabled_tools: string[];
  pinned: boolean;
  archived_at: string | null;
  active_leaf_message_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  /** Parent message in the conversation tree. Null only for the root message. */
  parent_message_id?: string | null;
  /** Tool call results for the assistant turn (null for user/system rows). */
  tool_events?: Array<{ call_id: string; name: string; status: "done"; args?: unknown; result?: unknown }> | null;
  /** Follow-up question suggestions generated after the assistant turn. */
  follow_ups?: string[] | null;
  /** Per-response token usage from the model. Null when the provider omits it. */
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  /** Why the assistant turn stopped abnormally (e.g. "tool_budget"). Null = normal. */
  stopped_reason?: string | null;
};

export type ConversationSummary = Pick<
  ConversationRow,
  "id" | "title" | "model" | "mode" | "is_public" | "share_token" | "system_prompt_id" | "disabled_tools" | "pinned" | "archived_at" | "updated_at"
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
const SUMMARY_COLS = "id,title,model,mode:chat_mode,is_public,share_token,system_prompt_id,disabled_tools,pinned,archived_at,updated_at";
const ROW_COLS = "id,user_id,title,model,mode:chat_mode,is_public,share_token,system_prompt_id,disabled_tools,pinned,archived_at,active_leaf_message_id,created_at,updated_at";

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
  opts: { archived?: boolean } = {},
): Promise<ConversationSummary[]> {
  let query = supabase
    .from("conversation")
    .select(SUMMARY_COLS)
    .eq("user_id", userId);

  // Default list shows active conversations only; `archived: true` shows the
  // archived bin. Archived items never mix into the default list.
  query = opts.archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  const { data, error } = await query
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .returns<ConversationSummary[]>();
  if (error) throw error;
  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/*  Usage statistics                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Append one row to the immutable usage ledger. Called per AI response that
 * reports token usage. Best-effort by design — the caller swallows errors so a
 * ledger write never breaks the chat stream.
 */
export async function recordUsageEvent(
  supabase: SupabaseClient,
  userId: string,
  event: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    toolCalls: number;
  },
): Promise<void> {
  const { error } = await supabase.from("usage_event").insert({
    user_id: userId,
    model: event.model,
    prompt_tokens: event.promptTokens,
    completion_tokens: event.completionTokens,
    total_tokens: event.totalTokens,
    tool_calls: event.toolCalls,
  });
  if (error) throw error;
}


export type UsageStats = {
  /** Lifetime consumption totals from the immutable usage ledger. */
  totals: {
    responses: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    toolCalls: number;
  };
  /** Per-day consumption for the trailing window, oldest → newest. */
  daily: Array<{
    date: string; // YYYY-MM-DD (UTC)
    responses: number;
    totalTokens: number;
  }>;
  /** Consumption grouped by model, descending by tokens. */
  byModel: Array<{ model: string; responses: number; totalTokens: number }>;
  /** Number of days included in the daily window. */
  windowDays: number;
};

/** Shape returned by the get_usage_stats Postgres RPC. */
type UsageStatsRpc = {
  totals: {
    responses: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    tool_calls: number;
  } | null;
  by_model: Array<{ model: string; responses: number; total_tokens: number }>;
  daily: Array<{ date: string; responses: number; total_tokens: number }>;
};

/**
 * Aggregate consumption for the Usage dashboard from the append-only usage
 * ledger. Reading from `usage_event` (rather than live message rows) means
 * deleting a conversation never erases historical usage.
 *
 * Aggregation runs inside Postgres via the `get_usage_stats` RPC, so a user
 * with a large lifetime ledger transfers only a totals row, a few model rows,
 * and one row per active day — not every event. `totals` and `byModel` are
 * lifetime; `daily` covers the trailing `windowDays`.
 */
export async function getUsageStats(
  supabase: SupabaseClient,
  userId: string,
  windowDays = 30,
): Promise<UsageStats> {
  const { data, error } = await supabase.rpc("get_usage_stats", {
    p_user_id: userId,
    p_window_days: windowDays,
  });
  if (error) throw error;
  const stats = (data ?? null) as UsageStatsRpc | null;

  const t = stats?.totals;
  const totals = {
    responses: t?.responses ?? 0,
    promptTokens: t?.prompt_tokens ?? 0,
    completionTokens: t?.completion_tokens ?? 0,
    totalTokens: t?.total_tokens ?? 0,
    toolCalls: t?.tool_calls ?? 0,
  };

  // Seed the daily buckets so quiet days render as gaps, not missing points,
  // then overlay the active days the RPC returned.
  const dailyMap = new Map<string, { responses: number; totalTokens: number }>();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dailyMap.set(d.toISOString().slice(0, 10), { responses: 0, totalTokens: 0 });
  }
  for (const row of stats?.daily ?? []) {
    const bucket = dailyMap.get(row.date);
    if (bucket) {
      bucket.responses = row.responses;
      bucket.totalTokens = row.total_tokens;
    }
  }

  const daily = [...dailyMap.entries()].map(([date, v]) => ({ date, ...v }));
  const byModel = (stats?.by_model ?? []).map((m) => ({
    model: m.model,
    responses: m.responses,
    totalTokens: m.total_tokens,
  }));

  return { totals, daily, byModel, windowDays };
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
  const all = data ?? [];

  return activePathFromLeaf(all, owner.active_leaf_message_id);
}

/**
 * Reconstructs the active conversation path: walk parent links from the active
 * leaf up to the root, then reverse to chronological order. Returns only the
 * messages on that path, so sibling branches don't all render at once.
 *
 * Falls back to the full created_at-ordered list when there's no active leaf or
 * the tree has no parent links yet (legacy conversations pre-backfill, or any
 * row whose parent chain is broken) — degrading to the old linear behavior
 * rather than dropping messages.
 */
function activePathFromLeaf(
  all: MessageRow[],
  activeLeafId: string | null,
): MessageRow[] {
  if (all.length === 0) return all;

  const hasTree = all.some((m) => m.parent_message_id != null);
  if (!hasTree || !activeLeafId) return all;

  const byId = new Map(all.map((m) => [m.id, m]));
  if (!byId.has(activeLeafId)) return all;

  const path: MessageRow[] = [];
  const seen = new Set<string>();
  let cursor: string | null = activeLeafId;
  while (cursor) {
    if (seen.has(cursor)) break; // guard against cycles
    seen.add(cursor);
    const node = byId.get(cursor);
    if (!node) break;
    path.push(node);
    cursor = node.parent_message_id ?? null;
  }
  path.reverse();
  return path;
}

/** Direct children of a message (its sibling branches share a parent). */
export async function listChildren(
  supabase: SupabaseClient,
  conversationId: string,
  parentMessageId: string | null,
  userId: string,
): Promise<MessageRow[]> {
  const owner = await getConversation(supabase, conversationId, userId);
  if (!owner) return [];

  let query = supabase
    .from("message")
    .select("*")
    .eq("conversation_id", conversationId);
  query =
    parentMessageId === null
      ? query.is("parent_message_id", null)
      : query.eq("parent_message_id", parentMessageId);

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();
  if (error) throw error;
  return data ?? [];
}

/** Sets which leaf the conversation displays. Owner-scoped. */
export async function setActiveLeaf(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  leafMessageId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversation")
    .update({ active_leaf_message_id: leafMessageId })
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}

/** Per-message branch navigation info for the active path. */
export type BranchInfo = {
  /** 1-based position of this message among its siblings (children of its parent). */
  index: number;
  /** Total number of siblings (1 = no branching at this point). */
  count: number;
  /** Sibling message ids in display order, so the client can pick prev/next. */
  siblingIds: string[];
};

/**
 * Computes branch-navigator info for each message on the active path: how many
 * siblings it has and where it sits among them. Pure; operates on the full row
 * set plus the already-resolved active path.
 */
export function computeBranchInfo(
  all: MessageRow[],
  path: MessageRow[],
): Map<string, BranchInfo> {
  // Group every message by its parent (null parent = roots).
  const childrenByParent = new Map<string | null, MessageRow[]>();
  for (const m of all) {
    const key = m.parent_message_id ?? null;
    const arr = childrenByParent.get(key);
    if (arr) arr.push(m);
    else childrenByParent.set(key, [m]);
  }
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  }

  const info = new Map<string, BranchInfo>();
  for (const m of path) {
    const siblings = childrenByParent.get(m.parent_message_id ?? null) ?? [m];
    const idx = siblings.findIndex((s) => s.id === m.id);
    info.set(m.id, {
      index: idx >= 0 ? idx + 1 : 1,
      count: siblings.length,
      siblingIds: siblings.map((s) => s.id),
    });
  }
  return info;
}

/**
 * From a starting message, descend to a leaf by always following the NEWEST
 * child. Used when activating a sibling branch: the client passes the sibling
 * it picked, and we resolve the deepest message on that branch to use as the
 * active leaf. Returns the start id itself when it has no children.
 */
export async function resolveBranchLeaf(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  startMessageId: string,
): Promise<string | null> {
  const owner = await getConversation(supabase, conversationId, userId);
  if (!owner) return null;

  const { data, error } = await supabase
    .from("message")
    .select("id,parent_message_id,created_at")
    .eq("conversation_id", conversationId)
    .returns<Array<Pick<MessageRow, "id" | "parent_message_id" | "created_at">>>();
  if (error) throw error;
  const rows = data ?? [];

  const childrenByParent = new Map<string, Array<{ id: string; created_at: string }>>();
  for (const r of rows) {
    if (!r.parent_message_id) continue;
    const arr = childrenByParent.get(r.parent_message_id);
    if (arr) arr.push({ id: r.id, created_at: r.created_at });
    else childrenByParent.set(r.parent_message_id, [{ id: r.id, created_at: r.created_at }]);
  }

  let cursor = startMessageId;
  const seen = new Set<string>();
  while (!seen.has(cursor)) {
    seen.add(cursor);
    const kids = childrenByParent.get(cursor);
    if (!kids || kids.length === 0) break;
    kids.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    cursor = kids[kids.length - 1].id; // newest child
  }
  return cursor;
}

export async function createConversation(
  supabase: SupabaseClient,
  args: { userId: string; model: string; mode?: ConversationMode; title?: string; systemPromptId?: string | null },
): Promise<ConversationSummary> {
  const { data, error } = await supabase
    .from("conversation")
    .insert({
      user_id: args.userId,
      model: args.model,
      ...(args.mode ? { chat_mode: args.mode } : {}),
      ...(args.title ? { title: args.title } : {}),
      ...(args.systemPromptId ? { system_prompt_id: args.systemPromptId } : {}),
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
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
    stoppedReason?: string | null;
    /**
     * Parent in the message tree. When omitted, defaults to the conversation's
     * current active leaf, so a normal append extends the active path. Pass an
     * explicit value (including null for a root) to branch.
     */
    parentMessageId?: string | null;
  },
): Promise<MessageRow> {
  const owner = await getConversation(supabase, args.conversationId, args.userId);
  if (!owner) {
    throw new Error("Conversation not found");
  }
  const parentId =
    args.parentMessageId !== undefined
      ? args.parentMessageId
      : owner.active_leaf_message_id;
  const { data, error } = await supabase
    .from("message")
    .insert({
      conversation_id: args.conversationId,
      role: args.role,
      content: args.content,
      parent_message_id: parentId,
      ...(args.toolEvents?.length ? { tool_events: args.toolEvents } : {}),
      ...(args.followUps?.length ? { follow_ups: args.followUps } : {}),
      ...(args.usage?.promptTokens != null ? { prompt_tokens: args.usage.promptTokens } : {}),
      ...(args.usage?.completionTokens != null ? { completion_tokens: args.usage.completionTokens } : {}),
      ...(args.usage?.totalTokens != null ? { total_tokens: args.usage.totalTokens } : {}),
      ...(args.stoppedReason ? { stopped_reason: args.stoppedReason } : {}),
    })
    .select("*")
    .single<MessageRow>();
  if (error) throw error;

  // The newest message becomes the active leaf so the path it extends is what
  // renders. Best-effort: a failed update just leaves the leaf where it was.
  try {
    await supabase
      .from("conversation")
      .update({ active_leaf_message_id: data.id })
      .eq("id", args.conversationId)
      .eq("user_id", args.userId);
  } catch {
    // non-fatal
  }

  return data;
}

export async function updateConversation(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  patch: {
    title?: string;
    model?: string;
    mode?: ConversationMode;
    systemPromptId?: string | null;
    disabledTools?: string[];
    pinned?: boolean;
    archived?: boolean;
  },
): Promise<ConversationSummary | null> {
  const fields: Record<string, unknown> = {};
  if (patch.title !== undefined) fields.title = patch.title;
  if (patch.model !== undefined) fields.model = patch.model;
  if (patch.mode !== undefined) fields.chat_mode = patch.mode;
  if (patch.systemPromptId !== undefined) fields.system_prompt_id = patch.systemPromptId;
  if (patch.disabledTools !== undefined) fields.disabled_tools = patch.disabledTools;
  if (patch.pinned !== undefined) fields.pinned = patch.pinned;
  if (patch.archived !== undefined) {
    fields.archived_at = patch.archived ? new Date().toISOString() : null;
  }

  // Pin/archive are organizational state, not content — they must not reorder
  // the list by bumping recency. Only bump `updated_at` when the conversation's
  // actual content/config changed.
  const isContentEdit =
    patch.title !== undefined ||
    patch.model !== undefined ||
    patch.mode !== undefined ||
    patch.systemPromptId !== undefined ||
    patch.disabledTools !== undefined;
  if (isContentEdit) fields.updated_at = new Date().toISOString();

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

/**
 * Prepares a regenerate by branching instead of deleting. Moves the active leaf
 * to the parent of the latest assistant message on the active path, so the
 * regenerated reply is appended as a NEW sibling branch and the previous reply
 * is retained (reachable via the sibling navigator). Returns false when there's
 * no trailing assistant message to regenerate from.
 *
 * Named for backwards-compat with the regenerate route; no longer deletes.
 */
export async function deleteLastAssistantMessage(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const owner = await getConversation(supabase, conversationId, userId);
  if (!owner) return false;

  // Find the latest assistant message on the ACTIVE path (not globally latest,
  // which could live on a different branch).
  const path = await getMessages(supabase, conversationId, userId);
  const lastAssistant = [...path].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return false;

  // Branch point is the assistant message's parent (typically the user turn).
  // Setting it as the active leaf means the next appended assistant message is a
  // sibling of `lastAssistant`, preserving the old branch.
  const branchPoint = lastAssistant.parent_message_id ?? null;
  if (branchPoint) {
    await setActiveLeaf(supabase, conversationId, userId, branchPoint);
  }
  return true;
}

/**
 * Edits a user message by creating a NEW sibling branch instead of mutating in
 * place and truncating. The new user message shares the edited message's parent
 * and becomes the active leaf, so generation continues on the fresh branch while
 * the original branch (and its replies) is retained. Returns the new message, or
 * null if not found / not owned / not a user message.
 */
export async function branchUserMessage(
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

  // Insert a sibling sharing the edited message's parent. appendMessage sets it
  // as the new active leaf, so getMessages now follows this branch.
  return appendMessage(supabase, {
    conversationId: args.conversationId,
    userId: args.userId,
    role: "user",
    content: args.content,
    parentMessageId: target.parent_message_id ?? null,
  });
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
