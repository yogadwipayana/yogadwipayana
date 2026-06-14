-- Per-conversation tool toggles. Stores the set of tool *categories* the user
-- has switched off for a conversation (e.g. "web", "vps", "media", "memory",
-- "context7"). The chat stream filters these out of the tool list it sends to
-- the model. Category-level (not per-tool) because Context7 tools are
-- discovered at runtime and category granularity is the intended UX.

alter table public.conversation
  add column if not exists disabled_tools jsonb not null default '[]'::jsonb;
