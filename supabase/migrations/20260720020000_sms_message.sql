-- A one-time number is not a one-shot: SMSPool keeps it resendable for up to
-- ~120 hours (/sms/check_resend reports `expires_in_hour`, e.g. 115), so the
-- same number can collect many codes over several days.
--
-- Modelling those as extra `sms_order` rows would fight the schema — `order_id`
-- is unique (SMSPool issues one order code per number and resends reuse it),
-- `cost` would be counted once per message, and the open-order cap would read
-- resends as separate rentals. So messages get their own table.
--
-- `sms_order.code` / `full_sms` stay as the LATEST message, which is what the
-- order panel shows and what the refresh loop compares against to notice a new
-- SMS. That comparison is why `previous_code` existed; with `code` no longer
-- blanked on resend, the column is redundant and is dropped here.

create table if not exists public.sms_message (
  id            uuid primary key default uuid_generate_v4(),
  sms_order_id  uuid not null references public.sms_order(id) on delete cascade,
  code          text,
  full_sms      text,
  received_at   timestamptz not null default now()
);

-- Listing a number's messages, oldest first (delivery order).
create index if not exists sms_message_order_received_idx
  on public.sms_message (sms_order_id, received_at);

alter table public.sms_message enable row level security;

-- Ownership is inherited from the parent order rather than duplicating user_id,
-- so a message can never outlive or diverge from its rental's access rules.
drop policy if exists "sms_message_owner" on public.sms_message;
create policy "sms_message_owner"
  on public.sms_message
  for all
  using (
    exists (
      select 1 from public.sms_order o
      where o.id = sms_message.sms_order_id
        and o.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sms_order o
      where o.id = sms_message.sms_order_id
        and o.user_id = (select auth.uid())
    )
  );

-- Backfill: any code already recorded on an order becomes its first message.
insert into public.sms_message (sms_order_id, code, full_sms, received_at)
select o.id, o.code, o.full_sms, o.updated_at
from public.sms_order o
where o.code is not null
  and not exists (
    select 1 from public.sms_message m where m.sms_order_id = o.id
  );

-- Resend window, distinct from `expires_at` (which is only the ~20-minute
-- window for the FIRST SMS). Populated from /sms/check_resend.
alter table public.sms_order
  add column if not exists resend_expires_at timestamptz,
  add column if not exists resends_left      integer,
  add column if not exists resend_cost       numeric(10, 4);

alter table public.sms_order drop column if exists previous_code;
