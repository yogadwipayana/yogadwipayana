-- Take the money printer out of the browser's reach.
--
-- `credit_balance` / `debit_balance` were security-definer functions that read
-- `auth.uid()` and were granted to `authenticated`. PostgREST exposes every such
-- function as `POST /rest/v1/rpc/<name>`, so any signed-in user could call the
-- credit path straight from the browser with the publishable key and mint
-- themselves unlimited balance — no voucher, no API route, no rate limit.
--
-- The original `revoke all ... from public` did not help. `PUBLIC` is a
-- pseudo-role distinct from `anon` and `authenticated`, both of which Supabase
-- grants EXECUTE by default — and the migration then re-granted `authenticated`
-- explicitly. A probe with the publishable key proved the call was reaching the
-- function body: it answered `P0001 UNAUTHORIZED` (our own `raise`, tripped only
-- because the probe had no session) rather than `42501 permission denied`.
--
-- The fix has two halves, and both are needed:
--   1. Revoke EXECUTE from the client roles, so PostgREST refuses the call
--      outright with 42501 before any function body runs.
--   2. Name the caller explicitly with `p_user`, because `auth.uid()` is null
--      under the service role. The only callers are `creditBalance` /
--      `debitBalance` in src/lib/server/balance-service.ts, which pass the id
--      resolved from the session cookie — never a value read off a request body.
--
-- The in-body `UNAUTHORIZED` / `INVALID_*` guards stay. They are no longer the
-- thing standing between a user and free credit, but they still catch a server
-- bug that calls these with a null or nonsense argument.

-- The old 4-argument signatures are dropped rather than replaced: adding
-- `p_user` creates a new overload, and leaving the old one in place would leave
-- the exploitable entry point live alongside its replacement.
drop function if exists public.credit_balance(bigint, text, text, text);
drop function if exists public.debit_balance(bigint, text, text, text);

-- Credit a wallet and log the entry, atomically.
--
-- Raises `duplicate key value ... balance_transaction_reference_idx` (SQLSTATE
-- 23505) when the same reference is credited twice — callers treat that as
-- "already applied" rather than an error, which is what makes voucher redemption
-- and refunds safe to retry.
create or replace function public.credit_balance(
  p_user        uuid,
  p_amount      bigint,
  p_kind        text,
  p_reference   text default null,
  p_description text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new bigint;
begin
  if p_user is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_kind not in ('topup', 'sms_refund', 'adjustment') then
    raise exception 'INVALID_KIND';
  end if;

  insert into public.user_balance (user_id, balance_idr)
  values (p_user, 0)
  on conflict (user_id) do nothing;

  update public.user_balance
     set balance_idr = balance_idr + p_amount,
         updated_at  = now()
   where user_id = p_user
  returning balance_idr into v_new;

  insert into public.balance_transaction
    (user_id, amount_idr, kind, reference, description, balance_after)
  values
    (p_user, p_amount, p_kind, p_reference, p_description, v_new);

  return v_new;
end;
$$;

-- Debit a wallet, refusing to go negative.
--
-- Raises `INSUFFICIENT_BALANCE` when the wallet can't cover the amount. The
-- conditional UPDATE is the guard: it takes a row lock, so two concurrent orders
-- can never both pass an earlier balance check and overdraw.
create or replace function public.debit_balance(
  p_user        uuid,
  p_amount      bigint,
  p_kind        text,
  p_reference   text default null,
  p_description text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new bigint;
begin
  if p_user is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_kind not in ('sms_order', 'adjustment') then
    raise exception 'INVALID_KIND';
  end if;

  update public.user_balance
     set balance_idr = balance_idr - p_amount,
         updated_at  = now()
   where user_id = p_user
     and balance_idr >= p_amount
  returning balance_idr into v_new;

  if v_new is null then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into public.balance_transaction
    (user_id, amount_idr, kind, reference, description, balance_after)
  values
    (p_user, -p_amount, p_kind, p_reference, p_description, v_new);

  return v_new;
end;
$$;

-- `anon` and `authenticated` are named explicitly: revoking from `public` alone
-- is what left the original migration exploitable.
revoke all on function public.credit_balance(uuid, bigint, text, text, text)
  from public, anon, authenticated;
revoke all on function public.debit_balance(uuid, bigint, text, text, text)
  from public, anon, authenticated;

grant execute on function public.credit_balance(uuid, bigint, text, text, text)
  to service_role;
grant execute on function public.debit_balance(uuid, bigint, text, text, text)
  to service_role;
