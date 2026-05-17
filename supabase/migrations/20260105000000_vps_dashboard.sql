-- VPS dashboard schema, adapted from belajar-hosting for Supabase Auth.
-- Scope: a single `instance` table that holds VPS metadata + encrypted
-- provider credentials. Order/payment/admin/operation flows live elsewhere
-- (or app-side) and are intentionally not modeled here.
--
-- Notes:
--   - user_id is UUID and references auth.users(id)
--   - Credentials stored in encrypted form (APP_ENCRYPTION_KEY in env)
--   - No RLS yet — access control enforced by app-level WHERE user_id = $1
--     checks since routes connect via the pg pooler as a privileged role.

create extension if not exists pgcrypto;

-- ─── enums ────────────────────────────────────────────────────────────────
do $$
begin
  create type instance_visibility_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;

-- ─── instance ─────────────────────────────────────────────────────────────
create table if not exists public.instance (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  provider              text not null check (provider = 'tencent_lighthouse'),
  external_instance_id  text not null,
  name                  text not null,
  region                text not null,
  zone                  text,
  status                instance_visibility_status not null default 'active',
  provider_status       text not null,
  secret_id_enc         text,
  secret_key_enc        text,
  ip_public             text,
  ip_private            text,
  cpu                   int,
  memory_gb             int,
  system_disk_gb        int,
  bandwidth_mbps        int,
  os_name               text,
  expires_at            timestamptz,
  expires_at_overridden boolean not null default false,
  source                text not null check (source in ('order', 'byok_import')),
  last_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (provider, external_instance_id, user_id)
);

create index if not exists instance_user_id_idx on public.instance(user_id);
