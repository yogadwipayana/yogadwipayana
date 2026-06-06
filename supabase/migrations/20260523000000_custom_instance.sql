-- Allow user-defined "custom" instances on the VPS dashboard.
--
-- Until now the `instance` table only modeled Tencent Lighthouse VPSes:
--   provider = 'tencent_lighthouse', source in ('order','byok_import').
-- The BYOK page now lets a user add an arbitrary SSH target (host/port/user +
-- credentials) that isn't backed by a cloud provider. Those rows need:
--   provider = 'custom', source = 'custom'.
--
-- Custom rows carry no provider credentials (secret_id_enc / secret_key_enc
-- stay null) and are never touched by Tencent background sync, which only
-- selects rows that have stored credentials.

alter table public.instance
  drop constraint if exists instance_provider_check;
alter table public.instance
  add constraint instance_provider_check
  check (provider in ('tencent_lighthouse', 'custom'));

alter table public.instance
  drop constraint if exists instance_source_check;
alter table public.instance
  add constraint instance_source_check
  check (source in ('order', 'byok_import', 'custom'));
