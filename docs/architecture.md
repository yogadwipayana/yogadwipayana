# Architecture

System design for the 2026 stack listed in `docs/tech-stack/prompt.txt`.

## Request lifecycle (happy path)

```
Browser
  │  HTTPS
  ▼
Caddy on EC2  ──TLS termination──▶  Next.js (Node.js)
  │                                   │
  │                                   ├── Server Component renders page (RSC)
  │                                   ├── Route Handler (src/app/api/*) runs server code
  │                                   ├── Supabase client (SSR) reads session cookies
  │                                   └── Calls OpenAI / S3 / Resend over HTTPS
  ▼
HTML / JSON / SSE  ◀───── back to browser
```

## Layer-by-layer responsibilities

### 1. Entry — browser
React 19 hydrates RSC payloads, then PostHog + GA fire once on first paint.

### 2. Compute / Hosting — AWS EC2
Single Node.js process behind Caddy. `npm run start` runs `next start`.
Outbound traffic to Supabase, S3, OpenAI, Resend uses the EC2 instance's
public NAT path. IAM role lets the app reach S3 without baked-in keys.

### 3. Frontend — Next.js (App Router)
- All routes live under `src/app`.
- Server Components are the default; client components are explicitly marked
  with `"use client"`.
- Middleware at `src/middleware.ts` refreshes the Supabase session cookie on
  every request and guards `/dashboard`.

### 4. Styling / UI — shadcn/ui
Configured via `components.json` (radix-nova style, neutral base). Components
are copied into the repo under `src/components/ui` — there's no runtime
dependency on a UI package.

### 5. Backend runtime — Node.js
Route Handlers under `src/app/api/*`:
- `POST /api/conversations` — create a chat conversation
- `GET /api/conversations` — list the caller's conversations
- `GET|PATCH|DELETE /api/conversations/[id]` — fetch, rename/retitle, or delete one
- `POST /api/conversations/[id]/messages` — append a user message and stream the assistant reply (SSE)
- `POST /api/ai` — one-shot OpenAI completion
- `POST /api/upload` — issue an S3 presigned PUT URL
- `POST /api/email` — Resend contact form
- `GET  /api/search` — Postgres FTS via `search_documents` RPC

Every authenticated endpoint calls `supabase.auth.getUser()` first.

### 6. Auth — Supabase Auth
Email OTP today (`signInWithOtp` + `verifyOtp`). OAuth buttons are stubbed
and ready to wire up. Sessions live in HTTP-only cookies managed by
`@supabase/ssr`. The middleware is the only thing that refreshes them.

### 7. Database — Supabase (Postgres)
- Schema in `supabase/migrations/*.sql`.
- All app tables use Row Level Security. The `documents` table is the
  canonical example.
- Postgres FTS uses a generated `tsvector` column with weights and a GIN
  index; queries go through a `search_documents` RPC for ranked snippets.

### 8. File / blob storage — AWS S3
Browser → `POST /api/upload` to get a presigned URL → `PUT` the bytes
directly to S3. Files are namespaced under `u/{user_id}/...`.
`NEXT_PUBLIC_S3_PUBLIC_URL` can point at CloudFront for public reads.

### 9. AI / LLM — OpenAI
Single client in `src/lib/openai.ts`. Streaming uses the OpenAI SDK's async
iterator, repackaged as SSE in the route handler. Model defaults to
`OPENAI_MODEL` (gpt-4o-mini).

### 10. Transactional email — Resend
`src/lib/email.ts` wraps the `resend` SDK. Contact form has a honeypot field
and uses `Reply-To` so replies go to the sender, not Resend.

### 11. Product analytics — PostHog
Client-side SDK initialised in `src/components/analytics/PostHogProvider.tsx`.
Auto-pageview is off; we capture `$pageview` ourselves on `pathname` change
so SPA route transitions count.

### 12. Web analytics — Google Analytics
Loaded via `@next/third-parties/google` in the root layout. No-op when
`NEXT_PUBLIC_GA_MEASUREMENT_ID` isn't set.

### 13. Search — Postgres FTS
See `supabase/migrations/20260101000000_documents_fts.sql`. Generated
tsvector, GIN index, RPC with `ts_headline` for highlighted snippets.

### 14. CMS / Content — Markdown / MDX
`@next/mdx` compiles `.mdx` files in `src/content/posts`. Frontmatter parsed
with `gray-matter` in `src/lib/posts.ts`. The blog routes (`/blog`,
`/blog/[slug]`) are statically generated via `generateStaticParams`.

### 15. CI / CD — GitHub Actions
- `.github/workflows/ci.yml` — lint + build on every PR / main push.
- `.github/workflows/deploy.yml` — SSH into EC2 and restart on main push.

## Tradeoffs & gotchas

| Concern | Tradeoff |
|---|---|
| **Single EC2** | Cheap and simple, but a single point of failure. Move behind an ALB with 2+ instances when uptime matters. |
| **Supabase RLS** | All authorization lives in the DB. Powerful, but mistakes are silent — write tests against policies. |
| **`getUser` in middleware** | Don't put any code between `createServerClient` and `getUser` or the refreshed cookie won't be attached. |
| **OpenAI cost** | Streaming responses are great UX but you still pay per token. Cap context length and `max_tokens`. |
| **Presigned uploads** | Bytes never hit our server (cheap), but we can't run virus scans inline. Run async checks via S3 events if it matters. |
| **PostHog + ad blockers** | If reach is critical, set up a reverse proxy at `/ingest` and point the SDK at that. |
| **MDX bundling** | Each post becomes its own RSC chunk. Hundreds of posts will inflate bundle metadata; switch to runtime MDX or a CMS when that bites. |
| **GA + PostHog overlap** | We pay for both. GA stays for SEO-friendly reporting; PostHog drives product decisions. Drop one once the picture is clear. |
| **No queue** | Anything slow (emails, AI, indexing) runs inline in a request. Add SQS / Supabase Queues if requests start timing out. |
