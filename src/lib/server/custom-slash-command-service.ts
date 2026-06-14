import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A user-defined `/trigger` slash command. When the user sends `/<trigger>` and
 * no built-in command matches, `content` is injected as an extra `system`
 * message for that turn (same mechanism as a saved system prompt). Built-in
 * commands always take precedence — see the parse/apply sites in the message,
 * edit, and regenerate routes.
 */
export type CustomSlashCommandRow = {
  id: string;
  user_id: string;
  trigger: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type CustomSlashCommandSummary = Pick<
  CustomSlashCommandRow,
  "id" | "trigger" | "description" | "content" | "created_at" | "updated_at"
>;

const COLS = "id,trigger,description,content,created_at,updated_at";

export async function listCustomSlashCommands(
  supabase: SupabaseClient,
  userId: string,
): Promise<CustomSlashCommandSummary[]> {
  const { data, error } = await supabase
    .from("custom_slash_command")
    .select(COLS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .returns<CustomSlashCommandSummary[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createCustomSlashCommand(
  supabase: SupabaseClient,
  args: { userId: string; trigger: string; description: string; content: string },
): Promise<CustomSlashCommandSummary> {
  const { data, error } = await supabase
    .from("custom_slash_command")
    .insert({
      user_id: args.userId,
      trigger: args.trigger,
      description: args.description,
      content: args.content,
    })
    .select(COLS)
    .single<CustomSlashCommandSummary>();
  if (error) throw error;
  return data;
}

export async function updateCustomSlashCommand(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  patch: { trigger?: string; description?: string; content?: string },
): Promise<CustomSlashCommandSummary | null> {
  const fields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.trigger !== undefined) fields.trigger = patch.trigger;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.content !== undefined) fields.content = patch.content;

  const { data, error } = await supabase
    .from("custom_slash_command")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId)
    .select(COLS)
    .maybeSingle<CustomSlashCommandSummary>();
  if (error) throw error;
  return data;
}

export async function deleteCustomSlashCommand(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("custom_slash_command")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}

/**
 * Looks up a single custom command by its trigger for a user. Used by the
 * parse/apply sites when the built-in `parseSlash` returns null. Owner-scoped
 * via the user_id filter on top of RLS.
 */
export async function getCustomSlashCommandByTrigger(
  supabase: SupabaseClient,
  userId: string,
  trigger: string,
): Promise<CustomSlashCommandSummary | null> {
  const { data, error } = await supabase
    .from("custom_slash_command")
    .select(COLS)
    .eq("user_id", userId)
    .eq("trigger", trigger.toLowerCase())
    .maybeSingle<CustomSlashCommandSummary>();
  if (error) throw error;
  return data;
}

/** Built-in slash triggers, which always take precedence over custom ones. */
const BUILTIN_TRIGGERS = new Set(["summarize", "diagram", "word"]);

/**
 * Resolves the system-prompt block for a user-defined slash command in a message
 * content string, or null when there's no leading `/trigger`, the trigger is a
 * built-in (handled by parseSlash), or no matching custom command exists.
 *
 * Call this in the chat routes ONLY when the built-in `parseSlash` returns null,
 * so built-in commands always win.
 */
export async function resolveCustomSlashBlock(
  supabase: SupabaseClient,
  userId: string,
  content: string,
): Promise<string | null> {
  const match = content.trim().match(/^\/([a-z]+)(?:\s|$)/);
  if (!match) return null;
  const trigger = match[1];
  if (BUILTIN_TRIGGERS.has(trigger)) return null;

  const command = await getCustomSlashCommandByTrigger(supabase, userId, trigger);
  const text = command?.content;
  return text && text.trim().length > 0 ? text : null;
}
