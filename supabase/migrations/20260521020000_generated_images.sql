-- Generated images: a per-user log of images produced by the image-gen tool,
-- backing the chat gallery view and the standalone /dashboard/image workspace.
--
-- The actual bytes still live in public/generated-images/ (or S3 once we
-- migrate). This table only stores metadata so we can list / sort / filter
-- without scanning the filesystem.

create table if not exists public.generated_image (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversation(id) on delete set null,
  url             text not null,
  prompt          text not null,
  model           text not null default 'cx/gpt-5.5-image',
  size            text,
  source_url      text,
  source          text not null default 'chat'
                    check (source in ('chat', 'workspace', 'admin')),
  created_at      timestamptz not null default now()
);

create index if not exists generated_image_user_id_idx
  on public.generated_image (user_id, created_at desc);

create index if not exists generated_image_conversation_id_idx
  on public.generated_image (conversation_id, created_at desc);

alter table public.generated_image enable row level security;

drop policy if exists "generated_image_owner" on public.generated_image;
create policy "generated_image_owner"
  on public.generated_image
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
