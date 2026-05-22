-- Add `chat_mode` to conversations so the chat UI can switch between
-- regular chat and image generation per conversation.
--
-- Note: the column is named `chat_mode` rather than `mode` because `mode`
-- collides with Postgres's built-in `mode()` ordered-set aggregate, which
-- causes PostgREST to misparse `select=...,mode,...` and raise
-- `42809: WITHIN GROUP is required for ordered-set aggregate mode`. The
-- column is aliased back to `mode` on the wire (see chat-service.ts).

alter table public.conversation
  add column if not exists chat_mode text not null default 'chat'
  check (chat_mode in ('chat', 'image'));
