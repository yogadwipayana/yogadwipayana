-- One row per code per number.
--
-- `recordMessage` is only called on a transition — when the code SMSPool reports
-- differs from the one already on the order — which stops a single poll loop
-- appending twice. It does not stop two of them: two dashboard tabs, or two
-- overlapping polls, can both observe the same transition and both insert. The
-- lifetime "delivered codes" figure then counts the same SMS more than once.
--
-- The constraint makes the second insert a 23505, which `recordMessage` swallows
-- as a no-op — the same idempotency pattern the ledger already relies on.
--
-- Partial, because `code` is nullable and NULLs are not comparable anyway: an
-- SMS logged without a parsed code is not a duplicate of another one.

-- Collapse any duplicates already recorded, keeping the earliest of each set.
delete from public.sms_message dup
using public.sms_message keep
where dup.code is not null
  and dup.sms_order_id = keep.sms_order_id
  and dup.code = keep.code
  and (keep.received_at, keep.id) < (dup.received_at, dup.id);

create unique index if not exists sms_message_order_code_idx
  on public.sms_message (sms_order_id, code)
  where code is not null;
