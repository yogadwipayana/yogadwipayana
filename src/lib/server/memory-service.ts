import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatMemorySource = "manual" | "ai";

export type ChatMemoryRow = {
  id: string;
  user_id: string;
  content: string;
  source: ChatMemorySource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const ROW_COLS = "id,user_id,content,source,is_active,created_at,updated_at";

// Hard caps so injected memory can never blow the model's context window. The
// char budget mirrors the chars-per-token estimate used by applyHistoryWindow
// (~4 chars/token): 8000 chars ≈ 2k tokens of memory, well within headroom.
const MAX_ACTIVE_MEMORIES = 100;
const MEMORY_CHAR_BUDGET = 8000;

/** All of a user's memory entries, newest first. */
export async function listMemories(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChatMemoryRow[]> {
  const { data, error } = await supabase
    .from("chat_memory")
    .select(ROW_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<ChatMemoryRow[]>();
  if (error) throw error;
  return data ?? [];
}

/**
 * Active memory entries used for system-prompt injection. Capped by count and
 * trimmed to a char budget (oldest dropped first) so a long memory list can't
 * overflow the context window.
 */
export async function listActiveMemories(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChatMemoryRow[]> {
  const { data, error } = await supabase
    .from("chat_memory")
    .select(ROW_COLS)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(MAX_ACTIVE_MEMORIES)
    .returns<ChatMemoryRow[]>();
  if (error) throw error;

  const rows = data ?? [];
  const kept: ChatMemoryRow[] = [];
  let usedChars = 0;
  for (const row of rows) {
    const cost = row.content.length;
    if (kept.length > 0 && usedChars + cost > MEMORY_CHAR_BUDGET) break;
    kept.push(row);
    usedChars += cost;
  }
  return kept;
}

export async function createMemory(
  supabase: SupabaseClient,
  userId: string,
  input: { content: string; source: ChatMemorySource },
): Promise<ChatMemoryRow> {
  const { data, error } = await supabase
    .from("chat_memory")
    .insert({
      user_id: userId,
      content: input.content,
      source: input.source,
    })
    .select(ROW_COLS)
    .single<ChatMemoryRow>();
  if (error) throw error;
  return data;
}

export async function updateMemory(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: { content?: string; is_active?: boolean },
): Promise<ChatMemoryRow | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;

  const { data, error } = await supabase
    .from("chat_memory")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select(ROW_COLS)
    .maybeSingle<ChatMemoryRow>();
  if (error) throw error;
  return data;
}

export async function deleteMemory(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("chat_memory")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}

/**
 * Render active memory rows into a `## Memory` system block, or null when there
 * are none. Injected after the base chat system prompt so the assistant treats
 * these as durable, cross-conversation facts about the user.
 */
export function buildMemorySystemBlock(rows: ChatMemoryRow[]): string | null {
  if (rows.length === 0) return null;
  const bullets = rows.map((r) => `- ${r.content.trim()}`).join("\n");
  return `# Memory (high priority — overrides conflicting defaults)

The following are durable facts and preferences the user has saved about themselves, their stack, and how they want you to respond. Treat them as standing instructions that apply across all conversations. Where any of these conflict with the default rules above — including the "match the user's language" rule, tone, and formatting defaults — THESE MEMORIES WIN. For example, if a memory says to always reply in a specific language, use that language regardless of which language the user writes in. Only the accuracy, safety, and tool-usage rules above still take precedence. Honor a memory unless the user explicitly overrides it in the current conversation.

${bullets}`;
}

/**
 * A short, high-recency restatement of active memory, meant to be inserted as a
 * `system` message RIGHT BEFORE the latest user turn (after the conversation
 * history). The base provider (gpt-5.5) tends to mimic the language/style of
 * prior assistant turns: once a conversation has English replies, a memory like
 * "always reply in Bahasa Indonesia" placed in the leading system message gets
 * ignored. Repeating it adjacent to the newest turn lets recency win over that
 * history momentum. Returns null when there is no active memory.
 */
export function buildMemoryReminder(rows: ChatMemoryRow[]): string | null {
  if (rows.length === 0) return null;
  const bullets = rows.map((r) => `- ${r.content.trim()}`).join("\n");
  return `Active memory reminder — apply these saved user preferences to this and every following reply, regardless of the language or style used earlier in this conversation:

${bullets}`;
}
