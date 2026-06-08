-- Generated documents: a per-user log of .docx files produced by the
-- word-gen tool, mirroring generated_image. Backs the chat download cards.
--
-- The actual bytes live in public/generated-documents/. This table only
-- stores metadata so we can list / sort / filter without scanning disk.

create table if not exists public.generated_document (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversation(id) on delete set null,
  url             text not null,
  title           text not null,
  prompt          text not null,
  format          text not null default 'docx'
                    check (format in ('docx')),
  source          text not null default 'chat'
                    check (source in ('chat', 'workspace', 'admin')),
  created_at      timestamptz not null default now()
);

create index if not exists generated_document_user_id_idx
  on public.generated_document (user_id, created_at desc);

create index if not exists generated_document_conversation_id_idx
  on public.generated_document (conversation_id, created_at desc);

alter table public.generated_document enable row level security;

drop policy if exists "generated_document_owner" on public.generated_document;
create policy "generated_document_owner"
  on public.generated_document
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
