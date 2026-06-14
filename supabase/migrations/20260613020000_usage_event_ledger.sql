-- Append-only usage ledger for the Chat Usage dashboard. Unlike message rows,
-- these survive conversation deletion: there is intentionally NO foreign key to
-- conversation, so cascade deletes can't erase historical consumption. One row
-- is written per AI response that reports token usage.
--
-- This is a billing/analytics ledger — rows are insert-only. There is no update
-- or delete policy, so once recorded, usage cannot be mutated by the client.

create extension if not exists "uuid-ossp";

create table if not exists public.usage_event (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  model             text not null,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens      integer not null default 0,
  tool_calls        integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists usage_event_user_id_created_idx
  on public.usage_event (user_id, created_at desc);

alter table public.usage_event enable row level security;

-- Owners may read their own usage.
drop policy if exists "usage_event_select_own" on public.usage_event;
create policy "usage_event_select_own"
  on public.usage_event
  for select
  using (user_id = auth.uid());

-- Owners may append their own usage. Insert-only: no update/delete policy, so
-- the ledger is immutable from the client's perspective.
drop policy if exists "usage_event_insert_own" on public.usage_event;
create policy "usage_event_insert_own"
  on public.usage_event
  for insert
  with check (user_id = auth.uid());
