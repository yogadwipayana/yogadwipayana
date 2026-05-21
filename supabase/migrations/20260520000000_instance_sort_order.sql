-- Per-user sort order for VPS instances so users can drag-reorder them in the
-- dashboard sub sidebar. Values are sparse (multiples of 1000) so we can later
-- insert rows between two existing entries without renumbering everything.

alter table public.instance add column if not exists sort_order integer;

with ranked as (
  select id,
         row_number() over (partition by user_id order by created_at asc) * 1000 as rn
  from public.instance
  where sort_order is null
)
update public.instance i
set sort_order = ranked.rn
from ranked
where i.id = ranked.id;

create index if not exists instance_user_sort_idx
  on public.instance(user_id, sort_order);
