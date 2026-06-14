-- Custom slash commands: a per-user library of `/trigger` shortcuts that inject
-- a reusable instruction block into the turn, mirroring system_prompt. Built-in
-- commands (/summarize, /diagram, /word) always take precedence over a user's
-- custom trigger, so users can't shadow tool-backed built-ins.
--
-- `trigger` is the word after the slash (lowercase a-z only, to match the
-- parser regex in slash-commands.ts). Unique per user, case-insensitive.

create table if not exists public.custom_slash_command (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  trigger     text not null check (trigger ~ '^[a-z]+$'),
  description text not null default '',
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists custom_slash_command_user_trigger_idx
  on public.custom_slash_command (user_id, lower(trigger));

create index if not exists custom_slash_command_user_id_idx
  on public.custom_slash_command (user_id, updated_at desc);

alter table public.custom_slash_command enable row level security;

drop policy if exists "custom_slash_command_owner" on public.custom_slash_command;
create policy "custom_slash_command_owner"
  on public.custom_slash_command
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
