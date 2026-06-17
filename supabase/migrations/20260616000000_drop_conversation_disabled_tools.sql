-- Drop the per-conversation tool toggle column. The chat "Tools on/off" feature
-- was removed; all tools are now always enabled, so the deny-list column is
-- obsolete. Safe to drop — no code reads or writes it anymore.

alter table public.conversation
  drop column if exists disabled_tools;
