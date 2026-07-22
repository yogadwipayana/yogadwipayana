-- Enforce the open-order cap in the database.
--
-- `createOrder` counted open orders and then inserted — two statements, so two
-- requests arriving together both read the same pre-insert total and both pass.
-- The order rate limit (5/min) is looser than the cap (3), so a burst could slip
-- a fourth number past it.
--
-- The application check stays as the fast path: it is what produces the friendly
-- 409 before any provider credit is spent. This trigger is the backstop that
-- makes the cap actually true.
--
-- Keep MAX_OPEN_ORDERS in src/lib/server/sms-service.ts in step with the 3 here.

create or replace function public.sms_order_enforce_open_cap()
returns trigger
language plpgsql
as $$
declare
  v_open integer;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  -- The advisory lock is what makes this atomic: without it, concurrent inserts
  -- would each count the same pre-insert total and each conclude there was room.
  -- Transaction-scoped and keyed on the user, so it never blocks anyone else.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*) into v_open
    from public.sms_order
   where user_id = new.user_id
     and status = 'pending';

  if v_open >= 3 then
    raise exception 'TOO_MANY_OPEN_ORDERS';
  end if;

  return new;
end;
$$;

-- Insert only. A resend puts an existing row back to `pending` without renting
-- another number, so it is not a new open order and must not be capped.
drop trigger if exists sms_order_open_cap on public.sms_order;
create trigger sms_order_open_cap
  before insert on public.sms_order
  for each row execute function public.sms_order_enforce_open_cap();
