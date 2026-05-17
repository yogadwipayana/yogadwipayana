-- Documents table with generated tsvector + GIN index for Postgres FTS.
-- Designed for a single-tenant index that any tool can write into
-- (e.g. blog posts, chat messages, VPS run notes).

create extension if not exists "uuid-ossp";

create table if not exists public.documents (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  source      text not null check (char_length(source) between 1 and 64), -- e.g. 'blog', 'chat'
  title       text not null,
  body        text not null default '',
  url         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Generated FTS column: title weighted A, body weighted B.
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')),  'B')
  ) stored
);

create index if not exists documents_fts_idx       on public.documents using gin (fts);
create index if not exists documents_user_id_idx   on public.documents (user_id);
create index if not exists documents_source_idx    on public.documents (source);

-- RLS: users see their own rows, plus rows with user_id NULL (public docs).
alter table public.documents enable row level security;

drop policy if exists "documents_select_own_or_public" on public.documents;
create policy "documents_select_own_or_public"
  on public.documents
  for select
  using (user_id is null or user_id = auth.uid());

drop policy if exists "documents_modify_own" on public.documents;
create policy "documents_modify_own"
  on public.documents
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Search RPC: parameterized, ranked, paginated.
create or replace function public.search_documents(
  q text,
  result_limit int default 20,
  result_offset int default 0
)
returns table (
  id uuid,
  source text,
  title text,
  url text,
  snippet text,
  rank real,
  created_at timestamptz
)
language sql
stable
as $$
  with query as (
    select websearch_to_tsquery('english', q) as ts
  )
  select
    d.id,
    d.source,
    d.title,
    d.url,
    ts_headline(
      'english',
      d.body,
      (select ts from query),
      'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MinWords=8, MaxWords=24'
    ) as snippet,
    ts_rank(d.fts, (select ts from query)) as rank,
    d.created_at
  from public.documents d, query
  where d.fts @@ query.ts
  order by rank desc, d.created_at desc
  limit greatest(result_limit, 1)
  offset greatest(result_offset, 0);
$$;
