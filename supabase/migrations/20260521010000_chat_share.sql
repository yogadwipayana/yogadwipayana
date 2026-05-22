-- Chat sharing: public share tokens + RLS for anonymous read access.

alter table public.conversation
  add column if not exists is_public boolean not null default false,
  add column if not exists share_token text;

create unique index if not exists conversation_share_token_idx
  on public.conversation (share_token)
  where share_token is not null;

-- Allow anyone (incl. anon role) to SELECT a conversation when it has been
-- explicitly published. Write access is still gated by the owner-only policy.
drop policy if exists "conversation_public_read" on public.conversation;
create policy "conversation_public_read"
  on public.conversation
  for select
  to anon, authenticated
  using (is_public = true and share_token is not null);

-- Mirror the read for messages of a public conversation.
drop policy if exists "message_public_read" on public.message;
create policy "message_public_read"
  on public.message
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.conversation c
      where c.id = message.conversation_id
        and c.is_public = true
        and c.share_token is not null
    )
  );
