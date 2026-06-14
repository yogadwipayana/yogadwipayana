-- Conversation branching. Replaces truncate-on-edit with a retained message
-- tree: each message points to its parent, and the conversation tracks which
-- leaf is "active" (the path currently displayed). Editing a user message or
-- regenerating an assistant turn now creates a sibling branch instead of
-- deleting; the old branch is kept and reachable via the sibling navigator.

-- Parent link. `on delete cascade` is a safety net (we never delete branch
-- messages in the new model; conversation deletion already cascades via
-- conversation_id).
alter table public.message
  add column if not exists parent_message_id uuid
    references public.message(id) on delete cascade;

-- Which leaf the conversation currently displays. Walk parent links from here
-- to the root to reconstruct the active path. `on delete set null` so a stray
-- delete degrades to the created_at fallback rather than dangling.
alter table public.conversation
  add column if not exists active_leaf_message_id uuid
    references public.message(id) on delete set null;

create index if not exists message_parent_idx
  on public.message (parent_message_id);

-- Backfill: chain existing messages into a linear branch per conversation,
-- ordered by created_at, so historical conversations render unchanged.
with ordered as (
  select
    id,
    lag(id) over (partition by conversation_id order by created_at, id) as prev_id
  from public.message
)
update public.message m
set parent_message_id = o.prev_id
from ordered o
where m.id = o.id
  and o.prev_id is not null
  and m.parent_message_id is null;

-- Point each conversation at its latest message as the active leaf.
with latest as (
  select distinct on (conversation_id) conversation_id, id
  from public.message
  order by conversation_id, created_at desc, id desc
)
update public.conversation c
set active_leaf_message_id = l.id
from latest l
where c.id = l.conversation_id
  and c.active_leaf_message_id is null;
