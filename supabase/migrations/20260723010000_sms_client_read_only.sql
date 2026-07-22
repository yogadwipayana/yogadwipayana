-- Make the SMS tables read-only to the browser.
--
-- Both tables carried a `for all` policy, which grants the owner INSERT, UPDATE
-- and DELETE — not just SELECT. Anonymous callers were blocked, but a signed-in
-- user IS the owner of their own rows, so `with check (user_id = auth.uid())`
-- waved their writes straight through. The refund logic in sms-service.ts trusts
-- `charge_ref`, `charged_idr`, `charge_delivered`, `status` and `expires_at` on
-- those rows, and all five were user-controlled:
--
--   * INSERT a fabricated `pending` order with `expires_at` in the past and a
--     `charged_idr`, then let the refresh loop "expire" it and refund a number
--     that never existed.
--   * UPDATE `charge_delivered` back to false on a completed order, then hit
--     Cancel & refund — keeping both the code and the money, which is exactly
--     the free-number hole `charge_delivered` was added to close.
--
-- Writes now go through the service role from src/lib/server/sms-service.ts,
-- each one explicitly scoped to the owning user. Reads stay on the cookie-scoped
-- client so RLS keeps confining the dashboard to its own rows.

drop policy if exists "sms_order_owner" on public.sms_order;
drop policy if exists "sms_order_owner_read" on public.sms_order;
create policy "sms_order_owner_read"
  on public.sms_order
  for select
  using (user_id = (select auth.uid()));

-- Ownership is inherited from the parent order rather than duplicating user_id,
-- so a message can never outlive or diverge from its rental's access rules.
drop policy if exists "sms_message_owner" on public.sms_message;
drop policy if exists "sms_message_owner_read" on public.sms_message;
create policy "sms_message_owner_read"
  on public.sms_message
  for select
  using (
    exists (
      select 1 from public.sms_order o
      where o.id = sms_message.sms_order_id
        and o.user_id = (select auth.uid())
    )
  );

-- Belt and braces: drop the write GRANTs too, which Supabase hands to
-- `anon`/`authenticated` by default on every table, leaving RLS as the only
-- gate. Two reasons this is worth doing on top of the policies above.
--
-- First, it fails LOUDLY. Policies filter, they don't refuse: with no UPDATE
-- policy an update simply matches no rows, so PostgREST answers 204 and the
-- caller cannot tell "blocked" from "nothing to do" — and neither can a retest.
-- Without EXECUTE on the table the same request is a flat
-- `42501 permission denied for table sms_order`.
--
-- Second, it survives a mistake. If a `for all` policy is ever reintroduced by
-- accident, the missing grant still stops the write.
revoke insert, update, delete on public.sms_order   from anon, authenticated;
revoke insert, update, delete on public.sms_message from anon, authenticated;
