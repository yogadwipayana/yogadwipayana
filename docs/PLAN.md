# Improvement & Feature Plan

Map of what to improve or add across the codebase, ordered by impact.

## 1. Bugs to fix first

1. **Negative prompt silently dropped** — `src/app/dashboard/image/workspace.tsx` collects `negativePrompt`, but `src/app/api/images/route.ts` `PostBody` has no field for it, so it never reaches the model. Wire it through or remove the UI.
2. **Broken OG admin redirect** — `src/app/dashboard/admin/og/page.tsx:21` redirects to `/auth/sign-in`, but the real route is `/sign-in`. Unauthenticated users hit a 404.
3. **Forced `tool_choice` may no-op** — `src/lib/server/chat-stream.ts:347` forces Context7/web_search via the object form of `tool_choice`, yet `src/lib/server/slash-commands.ts:82` documents that the gateway ignores forced choice and only honors `"auto"`. Smart-routing grounding likely does nothing.
4. **Edit/regenerate race** — `startGeneration` returns the existing in-flight generation (`src/lib/server/chat-registry.ts:62`), so editing mid-stream may attach to the stale generation instead of restarting.
5. **[DONE] R2 attachment edits wrongly rejected** — extracted a shared `validateAttachmentUrl` into `src/lib/server/vision.ts` (R2-existence check + SSRF fallback); both the edit and send routes now import it, and the send route's local copy was removed. Regenerate needs no change (reuses the existing message).

## 2. High-impact improvements — DONE

1. **[DONE] AI Router "hollow shell" was dead code, not a wired mock.** `AiRouterView` (with the mock metrics, "Test call"/"Replay" buttons, and `AI_RECENT_CALLS`) was never rendered — both `shell.tsx` and `/dashboard/ai/page.tsx` render `AiOverview`, a real menu linking to `/dashboard/ai/{usage,keys,billing}`, which already query live `usageHistory` via `aiDb`. Fix was to delete the misleading scaffolding: removed `AiRouterView` + its private `MetricCard`/`Action`/`Panel`/`CodeBlock` helpers from `views.tsx`, the `AiRoute`/`AiCall`/`AI_RECENT_CALLS` types/data from `data.ts`, and the now-unused `RotateCw` import.
2. **[DONE] `getUsageStats` no longer fetches the lifetime ledger.** `totals`/`byModel` are intentionally lifetime (the UI copy promises it) and `daily` is windowed, so a blanket `.gte` bound would have corrupted the totals. Instead added a Postgres RPC `get_usage_stats` (migration `supabase/migrations/20260614000000_usage_stats_rpc.sql`, `security invoker` so RLS still applies) that aggregates server-side; `chat-service.ts` now calls it and only transfers a totals row + a few model rows + active days. Daily gap-seeding preserved.
3. **[DONE] Added root `src/middleware.ts`** for Supabase session refresh, reusing a recreated `src/utils/supabase/middleware.ts` `updateSession` helper. Session-refresh only — per-layout `getUser()` redirects remain the authorization gate, so public pages stay accessible.
4. **[DONE] Richer shared/exported transcripts.** `PublicMessage` gained `toolEvents` + `followUps` (both already persisted on the `message` row). Share `Transcript.tsx` now renders a read-only tool-events block, inline images (markdown `img` renderer), and a follow-ups list; the export route (`src/app/api/conversations/[id]/export/route.ts`) adds a "Tools used" section and follow-ups.
5. **[DONE] Error states added** to `memory.tsx`, `system-prompts.tsx`, `usage.tsx` — failed loads show an inline error block with Retry; mutation failures surface without wiping input.
6. **[DONE] Rate-limit modules consolidated.** Folded the result-returning `rateLimit`/`rateLimitReset` API into `src/lib/server/rate-limit.ts`, repointed `auth/actions.ts`, and deleted the duplicate `src/lib/rate-limit.ts`. (Generation-registry single-process limitation noted but left as-is — it's a deploy-topology concern, not a bug.)

> Verification: all touched files pass `npx tsc --noEmit`. Remaining tsc errors are pre-existing in an unrelated in-progress image refactor (`image-service.ts` `ListGeneratedImagesResult`), untouched by this work.

## 3. New features

### Chat
1. ~~Conversation branching (edit already truncates — keep branches instead of discarding).~~ **Done** — `parent_message_id` on `message` + `active_leaf_message_id` on `conversation` (backfilled); `getMessages` walks the active path; edit/regenerate branch instead of delete (`branchUserMessage`, retained siblings); `/messages/[id]/activate` switches branch; `‹ idx/count ›` navigator in `views.tsx`.
2. ~~Stop → resume / "continue" past the tool-round limit.~~ **Done** — budget path now persists accumulated text + a `stopped_reason` marker and emits a `{stopped:"tool_budget"}` frame; a `/messages/continue` route re-streams a NEW assistant message (regenerate minus the delete) with a continuation instruction; client shows a Continue button (live + after reload via `stopped_reason`).
3. ~~Per-conversation tool toggles (disable VPS/web tools).~~ **Done** — `disabled_tools` jsonb on `conversation`; category-level toggles (web/vps/media/memory/context7) filtered in `getChatTools`; toolbar `ToolsSelector` in `views.tsx`.
4. ~~Conversation search / pin / archive in the sidebar.~~ **Done** — search was already client-side; added `pinned` + `archived_at` on `conversation`, pin-first ordering in `listConversations` (`?archived=1` for the bin), Pin/Archive in the sidebar ⋯ menu, a "Pinned" section, and an Archived view (`chat/archived.tsx`). Pin/archive don't bump `updated_at`.
5. ~~Custom slash commands stored alongside system prompts.~~ **Done** — `custom_slash_command` table (per-user `/trigger`, unique, RLS), service + `/api/custom-slash-commands` CRUD, resolved in all three chat routes (`resolveCustomSlashBlock`, built-ins take precedence), management view (`chat/custom-commands.tsx`), and merged into the composer autocomplete.

### Images
1. ~~Upscale / variations (reuse the `images` ref flow).~~ ✅ Done. Shipped as ref-generations: **Variations** (re-gen with current image as reference) and **Upscale** (re-gen at the largest matching aspect + "high resolution" prompt suffix). Note: the provider has **no true upscale param** (only discrete `size` values), so Upscale is an honest higher-res re-gen, not lossless upscaling.
2. Inpainting / mask edit in `workspace.tsx`. ⚠️ **Backend ready, UI deferred.** `image-gen.ts` switches to the `/images/edits` endpoint when a `mask` is passed (transparent area = edit region per OpenAI spec), and `/api/images` accepts `mask_url` (resolved via the same own-R2/SSRF pipeline, requires exactly one base image). **Not yet built:** the canvas mask-drawing UI. **Unverified:** the self-hosted `ai.yogathedev.com` router's actual `mask`/`edits` passthrough — needs live testing before exposing in the UI.
3. ~~One-click background removal on a generated image.~~ ✅ Done. Per-image "Remove background" button sends `background: "transparent"` (threaded through `image-gen.ts`, which previously hardcoded `"auto"`).
4. ~~Gallery pagination — the `before` cursor exists in `listGeneratedImages`, but `src/app/dashboard/chat/gallery.tsx` ignores it (fixed `limit=120`).~~ ✅ Done. `listGeneratedImages` now returns `{ images, nextCursor, hasMore }` (over-fetch-by-one); `GET /api/images` exposes the cursor; gallery uses IntersectionObserver infinite scroll (page size 48). **Caveat:** prompt search + date sort are now page-local (loaded rows only), not whole-DB — placeholder relabeled "Filter loaded…".
5. ~~Share links — `createPresignedDownloadUrl` in `src/lib/r2.ts:92` is already written but unused.~~ ✅ Done — **but PLAN was stale:** that helper was already in use (`chat-tools.ts:1065`). Added a new `GET /api/images/[id]/share` route returning a 1h presigned URL; gallery has a "Share" action. Returns 422 for external (non-R2) images, 409 if not ready.
6. ~~"Describe image → prompt" bridging `vision.ts` and the enhance endpoint.~~ ✅ Done. `/api/images/enhance` now accepts an optional `image_url` (resolved via own-R2/SSRF) and returns `{ prompt }` describing the image; workspace has a "Describe" button next to "Enhance".

**Also fixed (was bug, not feature):** negativePrompt was collected in `workspace.tsx` but dropped at `shell.tsx` (destructure omitted it) and absent from `PostBody`. Now threaded end-to-end as `negative_prompt` → `negativePrompt` → provider body.

**Pre-existing lint debt surfaced (not addressed, out of scope):** `react-hooks/set-state-in-effect` errors at `workspace.tsx:180` (`setElapsed(0)`) and `shell.tsx:1225` (`setMounted(true)`) — both pre-date this work.

### Memory / prompts / usage
1. Memory categories/tags + review-before-activate for AI-saved facts.
2. User-default system prompt (schema already supports per-conversation; add a user default).
3. Cost estimation (model → price join) + CSV/JSON export.
4. Combined usage view merging chat `usage_event` with the AI-router `usageHistory`.
5. ~~Graphviz pan/zoom + copy-as-PNG/SVG (`src/components/ui/GraphvizDiagram.tsx`); extend the same lazy-render pattern to Mermaid.~~ **Done** — shared `src/components/ui/DiagramViewer.tsx` adds wheel-zoom-to-cursor, drag-pan, zoom/reset, copy-as-PNG (canvas raster) and copy-as-SVG; both Graphviz and Mermaid use it, and Mermaid now lazy-imports via a module-level singleton like Graphviz.

### Dashboard
1. ~~Wire the inert ⌘K command palette (`src/app/dashboard/shell.tsx`) to cross-tool search.~~ **Done** — `CommandPalette` in `shell.tsx` opens via ⌘K/Ctrl+K or the top-bar buttons. Searches conversations (in-memory) plus lazily-fetched system prompts, memory, and images; lists Actions (new conversation/generation) and Navigate entries for every tool route. Keyboard nav (↑/↓/Enter/Esc), per-group result caps.
2. Audit log viewer — `recordAudit` already writes events; surface them in Settings.
3. VPS metrics / expiry alerts (`expiresAt` is already tracked).
4. Auto-apply OG images instead of manual copy-paste.

## Suggested sequencing

Fix the 5 bugs in section 1 first (small, isolated), then pick one big rock — making the AI Router dashboard real, or adding the auth middleware — since those define how trustworthy the rest of the tools feel.
