-- Token usage tracking on chat messages. The model already emits per-response
-- usage (prompt/completion/total) which is streamed to the client; these
-- columns persist it so the Usage dashboard can chart consumption over time.
-- Nullable: pre-existing rows and any turn where the provider omits usage stay
-- null and are simply excluded from token aggregates.

alter table public.message
  add column if not exists prompt_tokens     integer,
  add column if not exists completion_tokens integer,
  add column if not exists total_tokens      integer;
