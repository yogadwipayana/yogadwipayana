-- Tighten access on the VPS dashboard tables.
--
-- Background: the original `instance` migration left RLS off and relied on
-- app-side `WHERE user_id = $1` filters. That's not enough — clients hold a
-- valid Supabase JWT and can call PostgREST directly, so without RLS any
-- authenticated user could read every other user's encrypted credentials,
-- public IPs, and SSH passwords.
--
-- This migration:
--   1. Idempotently creates `instance_ssh_credential` (it was previously only
--      defined in code, never as a checked-in migration).
--   2. Adds `host_fingerprint_sha256` to `instance` for TOFU SSH host pinning.
--   3. Enables RLS + owner-only policies on both tables.

create extension if not exists pgcrypto;

-- ─── instance_ssh_credential ──────────────────────────────────────────────
create table if not exists public.instance_ssh_credential (
  instance_id     uuid primary key references public.instance(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  username        text not null,
  port            integer not null check (port between 1 and 65535),
  auth_method     text not null check (auth_method in ('password', 'key')),
  password_enc    text,
  private_key_enc text,
  passphrase_enc  text,
  host_override   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists instance_ssh_credential_user_id_idx
  on public.instance_ssh_credential (user_id);

-- Keep updated_at fresh on every modification.
create or replace function public.instance_ssh_credential_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists instance_ssh_credential_set_updated_at on public.instance_ssh_credential;
create trigger instance_ssh_credential_set_updated_at
  before update on public.instance_ssh_credential
  for each row execute function public.instance_ssh_credential_set_updated_at();

-- ─── SSH host fingerprint pinning (TOFU) ──────────────────────────────────
alter table public.instance
  add column if not exists host_fingerprint_sha256 text;

-- ─── Row Level Security ───────────────────────────────────────────────────
alter table public.instance enable row level security;
alter table public.instance_ssh_credential enable row level security;

drop policy if exists "instance_owner" on public.instance;
create policy "instance_owner"
  on public.instance
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "instance_ssh_credential_owner" on public.instance_ssh_credential;
create policy "instance_ssh_credential_owner"
  on public.instance_ssh_credential
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Make sure no leftover anon-role grants leak through. RLS is the gate, but
-- removing the unused privilege is cheap defence-in-depth.
revoke all on public.instance from anon;
revoke all on public.instance_ssh_credential from anon;
