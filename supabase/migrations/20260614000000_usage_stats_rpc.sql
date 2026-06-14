-- Server-side aggregation for the Chat Usage dashboard.
--
-- Previously the API fetched every row of usage_event for the user and grouped
-- it in JS on each request, so cost grew linearly with lifetime usage. This RPC
-- aggregates inside Postgres and returns a single JSON document: at most one
-- totals row, a handful of model rows, and one row per active day in the window.
-- No raw event rows cross the wire.
--
-- SECURITY INVOKER (the default): the function runs with the caller's rights, so
-- the usage_event RLS select policy still applies and a user can only ever
-- aggregate their own rows. The p_user_id argument is an explicit belt-and-braces
-- filter on top of RLS.
--
-- Semantics preserved from the prior JS implementation:
--   - totals  : LIFETIME (all rows)
--   - by_model: LIFETIME (all rows), descending by total tokens
--   - daily   : only the trailing p_window_days; gap-filling for quiet days is
--               done by the caller, which seeds the full date range.

create or replace function public.get_usage_stats(
  p_user_id uuid,
  p_window_days integer default 30
)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select model, prompt_tokens, completion_tokens, total_tokens, tool_calls, created_at
    from public.usage_event
    where user_id = p_user_id
  ),
  totals as (
    select
      count(*)::bigint                       as responses,
      coalesce(sum(prompt_tokens), 0)::bigint as prompt_tokens,
      coalesce(sum(completion_tokens), 0)::bigint as completion_tokens,
      coalesce(sum(total_tokens), 0)::bigint as total_tokens,
      coalesce(sum(tool_calls), 0)::bigint    as tool_calls
    from scoped
  ),
  by_model as (
    select model, count(*)::bigint as responses, coalesce(sum(total_tokens), 0)::bigint as total_tokens
    from scoped
    group by model
    order by total_tokens desc
  ),
  daily as (
    select
      to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as date,
      count(*)::bigint as responses,
      coalesce(sum(total_tokens), 0)::bigint as total_tokens
    from scoped
    where created_at >= now() - make_interval(days => greatest(p_window_days, 1))
    group by 1
    order by 1
  )
  select json_build_object(
    'totals', (select row_to_json(t) from totals t),
    'by_model', coalesce((select json_agg(m) from by_model m), '[]'::json),
    'daily', coalesce((select json_agg(d) from daily d), '[]'::json)
  );
$$;

revoke all on function public.get_usage_stats(uuid, integer) from public;
grant execute on function public.get_usage_stats(uuid, integer) to authenticated;
