-- Append-only audit log for security-sensitive actions: VPS power actions,
-- reinstall, password resets, SSH key operations, conversation share toggles,
-- and admin-only og-image generations.
--
-- Each row records who did what, against which resource, and from where.
-- The table is RLS-protected so users see their own audit entries; inserts
-- happen via service-side helpers (`recordAudit` in src/lib/server/audit.ts).
-- The owner can additionally bypass RLS via the service-role key for incident
-- response.

create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  action        text not null check (char_length(action) between 1 and 80),
  resource_type text check (resource_type is null or char_length(resource_type) between 1 and 64),
  resource_id   text check (resource_id is null or char_length(resource_id) between 1 and 128),
  ip            text,
  user_agent    text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_user_id_idx on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_owner_read" on public.audit_log;
create policy "audit_log_owner_read"
  on public.audit_log
  for select
  to authenticated
  using (user_id = auth.uid());

-- Authenticated users may insert their own rows; the user_id must match
-- their JWT to prevent forging another user's audit trail.
drop policy if exists "audit_log_owner_insert" on public.audit_log;
create policy "audit_log_owner_insert"
  on public.audit_log
  for insert
  to authenticated
  with check (user_id = auth.uid());

revoke update, delete on public.audit_log from authenticated, anon;
