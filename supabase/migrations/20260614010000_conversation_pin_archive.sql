-- Conversation pin + archive. `pinned` floats a conversation to the top of the
-- sidebar; `archived_at` (null = active) hides it from the default list while
-- keeping it retrievable. Index orders the default list pin-first then by
-- recency, scoped to non-archived rows since that's the common query.

alter table public.conversation
  add column if not exists pinned boolean not null default false;

alter table public.conversation
  add column if not exists archived_at timestamptz;

create index if not exists conversation_user_pinned_idx
  on public.conversation (user_id, pinned desc, updated_at desc)
  where archived_at is null;
