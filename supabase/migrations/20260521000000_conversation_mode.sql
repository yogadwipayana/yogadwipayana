-- Add `mode` to conversations so the chat UI can switch between
-- regular chat and image generation per conversation.

alter table public.conversation
  add column if not exists mode text not null default 'chat'
  check (mode in ('chat', 'image'));
