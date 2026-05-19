-- Chat: persisted conversations + messages backing /dashboard/chat.
-- RLS modeled on the documents table (see 20260101000000_documents_fts.sql).

create extension if not exists "uuid-ossp";

create table if not exists public.conversation (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New conversation',
  model       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversation_user_id_idx
  on public.conversation (user_id, updated_at desc);

create table if not exists public.message (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversation(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists message_conversation_id_idx
  on public.message (conversation_id, created_at);

alter table public.conversation enable row level security;
alter table public.message enable row level security;

drop policy if exists "conversation_owner" on public.conversation;
create policy "conversation_owner"
  on public.conversation
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "message_owner" on public.message;
create policy "message_owner"
  on public.message
  for all
  using (
    exists (
      select 1
      from public.conversation c
      where c.id = message.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversation c
      where c.id = message.conversation_id
        and c.user_id = auth.uid()
    )
  );
