# VPS dashboard backend

Adapted from `belajar-hosting/code` and trimmed down for the yogadwipayana
stack (Supabase Auth + raw `pg` against Supabase Postgres). The schema has
been collapsed to a single `instance` table — order/payment/admin/operation
flows live elsewhere (or app-side) and are not modeled in the database.

## Setup

1. **Apply the migration** in the Supabase SQL editor:
   `supabase/migrations/20260105000000_vps_dashboard.sql`

2. **Set required env vars** (see `.env.example`):
   - `DATABASE_URL` — Supabase Postgres connection (prefer the **pooler** URL
     for serverless: `aws-0-<region>.pooler.supabase.com:6543`).
   - `APP_ENCRYPTION_KEY` — 32 raw bytes, base64 encoded. Generate one with:
     ```bash
     openssl rand -base64 32
     ```
   - `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` / `TENCENT_DEFAULT_REGION` —
     fallback Lighthouse credentials. Optional if every user goes BYOK.

## Credential resolution order

`getCredentials(userId)` returns Tencent creds from the first source that
exists:

1. **BYOK** — the user's most recently updated `instance` row that has
   encrypted `secret_id_enc` / `secret_key_enc` columns.
2. **Environment** — `TENCENT_SECRET_ID` + `TENCENT_SECRET_KEY` env vars.

If none of those exist the route throws `400 CLOUD_ACCOUNT_REQUIRED`.

## API surface

All routes live under `/api/vps/*`. Every authenticated route calls
`requireUser()` which reads the Supabase session cookie.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/vps/instances?refresh=true` | List user VPS (optionally sync with Tencent first) |
| GET    | `/api/vps/instances/[id]/detail` | Detail + traffic packages |
| POST   | `/api/vps/instances/[id]/actions/[start\|stop\|reboot]` | Power control |
| POST   | `/api/vps/instances/[id]/reset-password` | `{ username, password }` |
| POST   | `/api/vps/instances/[id]/reinstall` | `{ blueprintId, password? \| keyId? }` |
| GET    | `/api/vps/instances/[id]/firewall` | List firewall rules |
| POST   | `/api/vps/instances/[id]/firewall` | Add rule |
| DELETE | `/api/vps/instances/[id]/firewall/[ruleId]` | Delete by ID |
| DELETE | `/api/vps/instances/[id]/firewall` | Delete by definition |
| POST   | `/api/vps/instances/[id]/ssh-keys/bind` | Attach key |
| DELETE | `/api/vps/instances/[id]/ssh-keys/[keyId]` | Detach key |
| GET    | `/api/vps/catalog` | Regions, zones, blueprints, bundles |
| POST   | `/api/vps/byok/connect` | Validate Tencent creds, list instances |
| POST   | `/api/vps/byok/import` | Import an existing Tencent instance + creds |
| GET    | `/api/vps/ssh-keys` | List Tencent key pairs |
| POST   | `/api/vps/ssh-keys/generate` | Server-side key generation |
| POST   | `/api/vps/ssh-keys/import` | Import an existing public key |
| PUT    | `/api/vps/ssh-keys/[keyId]` | Replace (delete + reimport) |
| DELETE | `/api/vps/ssh-keys/[keyId]` | Delete (unbinds first if attached) |

## Client helper

Use the typed client at <ref_file file="C:\Users\YOGA\Documents\yogadwipayana\src\lib\client\vps-api.ts" />:

```tsx
"use client";
import { useEffect, useState } from "react";
import { vpsApi, type VpsInstance } from "@/lib/client/vps-api";

export function MyVpsList() {
  const [instances, setInstances] = useState<VpsInstance[]>([]);
  useEffect(() => {
    vpsApi.listInstances().then((r) => setInstances(r.instances));
  }, []);
  return (
    <ul>{instances.map((i) => <li key={i.id}>{i.name} — {i.provider_status}</li>)}</ul>
  );
}
```

## Differences from the origin

- **Auth.** `requireUser()` reads cookies via `@supabase/ssr` instead of
  parsing better-auth headers. User IDs are UUIDs (Supabase) rather than
  TEXT (better-auth).
- **Database.** A single `instance` table referenced by `auth.users(id)`
  (UUID). No `"user"`, `"order"`, `payment`, `admin`, `instance_operation`,
  or `platform_cloud_account` tables — the order/payment/admin/operation
  flows from the origin are intentionally not modeled here.
- **Rate limiting.** Replaced Upstash Redis with an in-process sliding-window
  limiter (<ref_file file="C:\Users\YOGA\Documents\yogadwipayana\src\lib\server\rate-limit.ts" />).
  Good enough for a single EC2 instance. Swap in Upstash if you scale out.
- **Tencent client.** Kept verbatim. Has no DB / auth dependencies.

## What's *not* wired

- The existing `/dashboard/vps` UI still uses the hard-coded mock data from
  `src/app/dashboard/data.ts`. Replacing the mocks with live API calls is a
  UI task, not a backend task — see the client helper above to do it
  incrementally. Start with `vpsApi.listInstances()` to populate the
  sub-sidebar list.
- OAuth providers (Google / GitHub) on `/sign-in`. The OTP flow works.
