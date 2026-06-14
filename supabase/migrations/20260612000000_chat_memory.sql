-- Chat memory: a per-user store of durable facts and preferences. Active rows are
-- injected into the chat system prompt on every message (see listActiveMemories /
-- buildMemorySystemBlock and the messages route), so the assistant treats them as
-- standing instructions across all conversations. Entries come from two sources:
-- 'manual' (added by the user in the Memory view) and 'ai' (saved by the assistant
-- via the memory_save tool when the user states a lasting preference).

create table if not exists public.chat_memory (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  source      text not null default 'manual' check (source in ('manual', 'ai')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Lookup for listActiveMemories: filter by owner + active, newest first.
create index if not exists chat_memory_user_active_idx
  on public.chat_memory (user_id, is_active);

alter table public.chat_memory enable row level security;

drop policy if exists "chat_memory_owner" on public.chat_memory;
create policy "chat_memory_owner"
  on public.chat_memory
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
