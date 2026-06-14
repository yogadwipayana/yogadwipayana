-- Background image generation jobs.
--
-- Image generation now runs server-side as a fire-and-forget job so it
-- survives the client navigating away or reloading. We track job state on the
-- existing generated_image row instead of a separate jobs table, so the
-- workspace/gallery history and the in-flight job are the same record.
--
--   status = 'pending'   -> generation in flight, url is null
--   status = 'completed' -> url is populated with the proxy URL
--   status = 'failed'    -> error holds the failure message, url stays null
--
-- url becomes nullable because a pending row has no image yet. Existing rows
-- predate this column and default to 'completed', so they keep their url.

alter table public.generated_image
  add column if not exists status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  add column if not exists error text;

alter table public.generated_image
  alter column url drop not null;

-- Partial index to quickly find a user's in-flight jobs for polling.
create index if not exists generated_image_pending_idx
  on public.generated_image (user_id, created_at desc)
  where status = 'pending';
