-- Link an SMS order to the wallet entry that paid for it.
--
-- `charge_ref` is minted BEFORE the number is ordered and used as the ledger's
-- idempotency reference, so the debit exists even if the SMSPool call or the
-- row insert then fails — and the refund for that failure can find it.
--
-- `charged_idr` records what the buyer actually paid, so a later change to
-- SMS_PRICE_IDR never rewrites the price of an old order (or refunds the wrong
-- amount for one).

alter table public.sms_order
  add column if not exists charge_ref  uuid,
  add column if not exists charged_idr bigint;

-- One order per charge: makes a duplicated insert against the same debit visible
-- instead of silently double-billing.
create unique index if not exists sms_order_charge_ref_idx
  on public.sms_order (charge_ref)
  where charge_ref is not null;
