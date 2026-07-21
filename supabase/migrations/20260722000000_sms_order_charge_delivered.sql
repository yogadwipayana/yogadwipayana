-- Per-request billing for SMS numbers.
--
-- Every request for an SMS is now paid for separately: the initial order and
-- each resend. `charge_ref` / `charged_idr` therefore describe the request
-- currently in flight, not the order as a whole — a resend replaces them with
-- its own charge. The full sequence stays in balance_transaction, which is the
-- audit trail.
--
-- `charge_delivered` is what makes refunds correct. Status alone cannot answer
-- "was this charge honoured?": a resend puts a row back to `pending` while it
-- still carries the code from an earlier, already-paid request. Refunding on
-- status would hand back money for a code the buyer kept.
--
--   false -> the current request has not produced an SMS; a cancel or an expiry
--            owes the buyer their money back
--   true  -> the code arrived; the charge is settled and never refundable

alter table public.sms_order
  add column if not exists charge_delivered boolean not null default false;

-- Backfill: existing orders that hold a code were delivered what they paid for.
-- Orders with no charge_ref predate the wallet and have nothing to settle.
update public.sms_order
   set charge_delivered = true
 where code is not null
   and charge_ref is not null;
