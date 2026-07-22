Apply one file at a time — `supabase db push` is not usable here, the remote
migration history does not match the local files.

```
npx prisma db execute --file supabase/migrations/20260720000000_sms_order.sql --url <pooler>
npx prisma db execute --file supabase/migrations/20260721000000_balance.sql --url <pooler>
npx prisma db execute --file supabase/migrations/20260721010000_sms_order_charge.sql --url <pooler>
```

## Security fixes (docs/TEST.md)

Run these BEFORE deploying the matching code. `credit_balance` / `debit_balance`
gain a `p_user` argument, and the new app code calls the 5-argument signature —
deploy first and every wallet movement fails until the migration lands.

```
npx prisma db execute --file supabase/migrations/20260723000000_balance_server_only.sql --url <pooler>
npx prisma db execute --file supabase/migrations/20260723010000_sms_client_read_only.sql --url <pooler>
npx prisma db execute --file supabase/migrations/20260723020000_sms_message_unique_code.sql --url <pooler>
npx prisma db execute --file supabase/migrations/20260723030000_sms_open_order_cap.sql --url <pooler>
```

The reverse is safe: the migration alone (old code, new schema) fails closed —
wallet calls error instead of minting credit — so run it first and deploy after.

New environment variable: `CRON_SECRET`, the bearer token for
`GET /api/cron/sms-reconcile`. Unset, that endpoint answers 503 and lapsed
orders are only settled when a dashboard is open. Point a scheduler at it every
few minutes:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/sms-reconcile
```

*/5 * * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://yogathedev.com/api/cron/sms-reconcile >> /var/log/sms-reconcile.log 2>&1
