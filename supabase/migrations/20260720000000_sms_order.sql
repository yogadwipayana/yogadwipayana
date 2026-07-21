-- SMS OTP tool: a per-user log of disposable numbers rented from SMSPool for
-- OpenAI/Codex verification. SMSPool remains the source of truth for a live
-- order's state; these rows exist so the dashboard can list a user's own orders
-- (SMSPool's API key is app-wide, so its /request/active can't be filtered by
-- user) and so completed codes survive past SMSPool's short retention window.
--
-- `order_id` is SMSPool's 8-character order code. It is unique app-wide because
-- every order is placed with the same API key.
--
-- `status` mirrors SMSPool's /sms/check numeric status, normalized to names:
--   pending    (1) waiting for the SMS
--   cancelled  (2)
--   completed  (3) code received
--   refunded   (6)
--   expired    (timed out without a code)

create table if not exists public.sms_order (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  order_id      text not null unique,
  phone_number  text not null,
  country       text not null,
  service       text not null,
  service_id    integer not null,
  pool          text,
  cost          numeric(10, 4),
  status        text not null default 'pending'
                  check (status in ('pending', 'cancelled', 'completed', 'refunded', 'expired')),
  code          text,
  full_sms      text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Primary listing: a user's orders, newest first.
create index if not exists sms_order_user_created_idx
  on public.sms_order (user_id, created_at desc);

-- Polling loop: find every still-open order for a user to refresh in one pass.
create index if not exists sms_order_user_pending_idx
  on public.sms_order (user_id)
  where status = 'pending';

alter table public.sms_order enable row level security;

drop policy if exists "sms_order_owner" on public.sms_order;
create policy "sms_order_owner"
  on public.sms_order
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
