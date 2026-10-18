-- Client streamlining (app-flow review, 2026-10-18, bug 11): an extra block
-- the coach put on a day (0098: mobility, stretching, a fight session...) can
-- now be ticked off by the client as Done, or marked Couldn't do it, the same
-- way as the main workout. The result shows on the coach's calendar.
--
-- result is null until the client answers, then 'done' or 'skipped'.
-- result_at is when they answered.

alter table public.client_calendar_blocks
  add column if not exists result text check (result is null or result in ('done', 'skipped')),
  add column if not exists result_at timestamptz;

-- The client can't update blocks directly (only their trainer plans them), so
-- they answer through this. Only their own block, only one still on the
-- calendar, and only for today or a day already past. p_result null undoes it.
create or replace function public.set_my_block_result(p_block uuid, p_result text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  changed int;
begin
  if p_result is not null and p_result not in ('done', 'skipped') then
    raise exception 'Unknown result';
  end if;
  update public.client_calendar_blocks
  set result = p_result, result_at = case when p_result is null then null else now() end
  where id = p_block
    and client_id = me
    and removed_at is null
    and workout_date <= public.sa_today();
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke execute on function public.set_my_block_result(uuid, text) from public, anon;
grant execute on function public.set_my_block_result(uuid, text) to authenticated;
