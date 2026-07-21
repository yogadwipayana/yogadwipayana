-- Prepaid rupiah wallet. Today it only gates the SMS OTP tool; the ledger is
-- deliberately generic so another paid tool can debit it without a schema change.
--
-- Two tables on purpose:
--   user_balance       — the current figure, read on every page load
--   balance_transaction — the immutable ledger explaining how it got there
-- The balance is NOT derived by summing the ledger on read: a wallet checked on
-- every SMS order needs an O(1) read, and `balance_after` on each row keeps the
-- two reconcilable.
--
-- Amounts are whole rupiah in bigint. Rupiah has no minor unit in practice, and
-- integers keep money out of float rounding.

create table if not exists public.user_balance (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  balance_idr bigint not null default 0 check (balance_idr >= 0),
  updated_at  timestamptz not null default now()
);

create table if not exists public.balance_transaction (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Positive credits, negative debits. Never zero: a no-op is not an entry.
  amount_idr    bigint not null check (amount_idr <> 0),
  kind          text not null
                  check (kind in ('topup', 'sms_order', 'sms_refund', 'adjustment')),
  -- Idempotency handle: the voucher code for a top-up, the order's charge_ref
  -- for an SMS debit/refund. See the unique index below.
  reference     text,
  description   text,
  -- Balance immediately after this entry, so history is auditable without
  -- replaying the whole ledger.
  balance_after bigint not null,
  created_at    timestamptz not null default now()
);

-- Primary listing: a user's ledger, newest first.
create index if not exists balance_transaction_user_created_idx
  on public.balance_transaction (user_id, created_at desc);

-- The idempotency guarantee: one voucher can only ever be credited once, and one
-- SMS charge can only ever be refunded once. Global rather than per-user because
-- voucher codes and charge refs are already globally unique — this way a code
-- claimed by the wrong account still can't be credited twice.
create unique index if not exists balance_transaction_reference_idx
  on public.balance_transaction (kind, reference)
  where reference is not null;

alter table public.user_balance enable row level security;
alter table public.balance_transaction enable row level security;

-- Read-only for the owner. There are deliberately no INSERT/UPDATE policies:
-- money only moves through the security-definer functions below, so a leaked
-- anon key can never mint credit.
drop policy if exists "user_balance_owner_read" on public.user_balance;
create policy "user_balance_owner_read"
  on public.user_balance
  for select
  using (user_id = (select auth.uid()));

drop policy if exists "balance_transaction_owner_read" on public.balance_transaction;
create policy "balance_transaction_owner_read"
  on public.balance_transaction
  for select
  using (user_id = (select auth.uid()));

/* -------------------------------------------------------------------------- */
/*  Money movement                                                             */
/* -------------------------------------------------------------------------- */

-- Credit the caller's wallet and log the entry, atomically.
--
-- Raises `duplicate key value ... balance_transaction_reference_idx` (SQLSTATE
-- 23505) when the same reference is credited twice — callers treat that as
-- "already applied" rather than an error, which is what makes voucher redemption
-- and refunds safe to retry.
create or replace function public.credit_balance(
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
  v_user uuid := auth.uid();
  v_new  bigint;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_kind not in ('topup', 'sms_refund', 'adjustment') then
    raise exception 'INVALID_KIND';
  end if;

  insert into public.user_balance (user_id, balance_idr)
  values (v_user, 0)
  on conflict (user_id) do nothing;

  update public.user_balance
     set balance_idr = balance_idr + p_amount,
         updated_at  = now()
   where user_id = v_user
  returning balance_idr into v_new;

  insert into public.balance_transaction
    (user_id, amount_idr, kind, reference, description, balance_after)
  values
    (v_user, p_amount, p_kind, p_reference, p_description, v_new);

  return v_new;
end;
$$;

-- Debit the caller's wallet, refusing to go negative.
--
-- Raises `INSUFFICIENT_BALANCE` when the wallet can't cover the amount. The
-- conditional UPDATE is the guard: it takes a row lock, so two concurrent orders
-- can never both pass an earlier balance check and overdraw.
create or replace function public.debit_balance(
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
  v_user uuid := auth.uid();
  v_new  bigint;
begin
  if v_user is null then
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
   where user_id = v_user
     and balance_idr >= p_amount
  returning balance_idr into v_new;

  if v_new is null then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into public.balance_transaction
    (user_id, amount_idr, kind, reference, description, balance_after)
  values
    (v_user, -p_amount, p_kind, p_reference, p_description, v_new);

  return v_new;
end;
$$;

revoke all on function public.credit_balance(bigint, text, text, text) from public;
revoke all on function public.debit_balance(bigint, text, text, text) from public;
grant execute on function public.credit_balance(bigint, text, text, text) to authenticated;
grant execute on function public.debit_balance(bigint, text, text, text) to authenticated;
