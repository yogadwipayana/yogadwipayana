-- Marks WHY an assistant message ended, when it didn't end normally. Currently
-- only 'tool_budget' (the model hit MAX_TOOL_ROUNDS and was cut off). Null for
-- normal completions. The client uses this to show a "Continue" button both
-- live (via a stream frame) and after reload (from this column).

alter table public.message
  add column if not exists stopped_reason text;
