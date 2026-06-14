-- System prompts: a per-user library of reusable system-prompt blocks that can
-- be attached to a conversation. When set, the conversation's prompt is injected
-- as an extra `system` message after the base CHAT_SYSTEM_PROMPT (see the
-- messages route), so the assistant follows the user's custom instructions on
-- top of the app's defaults.

create table if not exists public.system_prompt (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists system_prompt_user_id_idx
  on public.system_prompt (user_id, updated_at desc);

alter table public.system_prompt enable row level security;

drop policy if exists "system_prompt_owner" on public.system_prompt;
create policy "system_prompt_owner"
  on public.system_prompt
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Which saved prompt this conversation uses. Nullable: most conversations use
-- the default prompt only. `on delete set null` so deleting a prompt from the
-- library detaches it from conversations rather than cascading the delete.
alter table public.conversation
  add column if not exists system_prompt_id uuid
    references public.system_prompt(id) on delete set null;
